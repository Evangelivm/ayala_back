import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaThirdService } from '../../prisma/prisma-third.service';
import { PrismaService } from '../../prisma/prisma.service';

interface BackendLog {
  timestamp: string;
  accion: string;
  status: 'ok' | 'error';
  respuesta: string;
}

const MAX_LOGS = 15;
const MAX_RESPONSE_LENGTH = 4000;

// Rutas a ignorar (lectura o endpoints de logs propios)
const SKIP_SUFFIXES = ['backend-logs', 'upload-pdf', 'upload-cotizacion', 'upload-factura', 'upload-comprobante-retencion'];

function getActionName(method: string, url: string): string {
  const path = url.split('?')[0];
  const suffixMatch = path.match(/\/\d+\/(.+)$/);
  const suffix = suffixMatch ? suffixMatch[1] : null;

  if (suffix) {
    const actionMap: Record<string, string> = {
      restore: 'Restaurar',
      'aprobar-contabilidad': 'Aprobar Contabilidad',
      'aprobar-administrador': 'Aprobar Administrador',
      'aprobar-jefe-proyecto': 'Aprobar Jefe de Proyecto',
      transferir: 'Transferir',
      pagar: 'Pagar',
      'numero-factura': 'Actualizar N° Factura',
      'firma-digital': 'Firma Digital',
    };
    return actionMap[suffix] ?? suffix;
  }

  const methodMap: Record<string, string> = {
    POST: 'Crear',
    PUT: 'Actualizar',
    PATCH: 'Actualizar',
    DELETE: 'Eliminar',
  };
  return methodMap[method] ?? method;
}

function buildLogEntry(accion: string, status: 'ok' | 'error', data: unknown): BackendLog {
  let respuesta: string;
  try {
    respuesta = JSON.stringify(data, null, 2);
    if (respuesta.length > MAX_RESPONSE_LENGTH) {
      respuesta = respuesta.slice(0, MAX_RESPONSE_LENGTH) + '\n... (truncado)';
    }
  } catch {
    respuesta = String(data);
  }
  return {
    timestamp: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
    accion,
    status,
    respuesta,
  };
}

function mergeLog(existing: string | null, newLog: BackendLog): string {
  let logs: BackendLog[] = [];
  if (existing) {
    try { logs = JSON.parse(existing); } catch { logs = []; }
  }
  return JSON.stringify([newLog, ...logs].slice(0, MAX_LOGS));
}

@Injectable()
export class BackendLogsInterceptor implements NestInterceptor {
  constructor(
    private readonly prismaThird: PrismaThirdService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, params } = req;

    // Solo capturar escrituras
    if (method === 'GET') return next.handle();

    // Ignorar rutas de logs y uploads
    const path = url.split('?')[0];
    const shouldSkip = SKIP_SUFFIXES.some((s) => path.includes(s));
    if (shouldSkip) return next.handle();

    const accion = getActionName(method, url);

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.persistLog(url, params, data, accion, 'ok').catch(() => {});
        },
        error: (err) => {
          const errData = { error: err?.message ?? String(err), statusCode: err?.status };
          this.persistLog(url, params, errData, accion, 'error').catch(() => {});
        },
      }),
    );
  }

  private async persistLog(
    url: string,
    params: Record<string, string>,
    data: unknown,
    accion: string,
    status: 'ok' | 'error',
  ): Promise<void> {
    const path = url.split('?')[0];
    const log = buildLogEntry(accion, status, data);

    // ─── Órdenes de Compra ───────────────────────────────────────────────────
    if (path.includes('/ordenes-compra')) {
      // ID desde params o desde body de respuesta (al crear)
      let id = params?.id ? parseInt(params.id) : null;
      if (!id && data && typeof data === 'object' && 'id_orden_compra' in data) {
        id = (data as any).id_orden_compra;
      }
      if (!id || isNaN(id)) return;

      const current = await this.prismaThird.ordenes_compra.findUnique({
        where: { id_orden_compra: id },
        select: { backend_logs: true },
      });
      if (!current) return;

      await this.prismaThird.ordenes_compra.update({
        where: { id_orden_compra: id },
        data: { backend_logs: mergeLog(current.backend_logs, log) },
      });
      return;
    }

    // ─── Órdenes de Servicio ─────────────────────────────────────────────────
    if (path.includes('/ordenes-servicio')) {
      let id = params?.id ? parseInt(params.id) : null;
      if (!id && data && typeof data === 'object' && 'id_orden_servicio' in data) {
        id = (data as any).id_orden_servicio;
      }
      if (!id || isNaN(id)) return;

      const current = await this.prismaThird.ordenes_servicio.findUnique({
        where: { id_orden_servicio: id },
        select: { backend_logs: true },
      });
      if (!current) return;

      await this.prismaThird.ordenes_servicio.update({
        where: { id_orden_servicio: id },
        data: { backend_logs: mergeLog(current.backend_logs, log) },
      });
      return;
    }

    // ─── Facturas ────────────────────────────────────────────────────────────
    if (path.includes('/facturas')) {
      let id = params?.id ? parseInt(params.id) : null;
      if (!id && data && typeof data === 'object' && 'id_factura' in data) {
        id = (data as any).id_factura;
      }
      if (!id || isNaN(id)) return;

      const current = await this.prismaThird.factura.findUnique({
        where: { id_factura: id },
        select: { backend_logs: true },
      });
      if (!current) return;

      await this.prismaThird.factura.update({
        where: { id_factura: id },
        data: { backend_logs: mergeLog(current.backend_logs, log) },
      });
      return;
    }

    // ─── Programación Técnica ────────────────────────────────────────────────
    if (path.includes('/programacion/tecnica') || path.includes('/programacion')) {
      let id = params?.id ? parseInt(params.id) : null;
      if (!id && data && typeof data === 'object' && 'id' in data) {
        id = (data as any).id;
      }
      if (!id || isNaN(id)) return;

      const current = await this.prisma.programacion_tecnica.findUnique({
        where: { id },
        select: { backend_logs: true },
      });
      if (!current) return;

      await this.prisma.programacion_tecnica.update({
        where: { id },
        data: { backend_logs: mergeLog(current.backend_logs, log) },
      });
    }
  }
}
