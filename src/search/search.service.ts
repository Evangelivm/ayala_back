import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaThirdService } from '../prisma/prisma-third.service';
import { Prisma } from '@generated/prisma';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export type SearchIndex =
  | 'programacion_tecnica'
  | 'ordenes_compra'
  | 'ordenes_servicio';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: Client;
  private esAvailable = false;
  // Por índice: true solo si tiene datos (reindex corrido o docs creados vía hooks)
  private esIndexReady: Record<SearchIndex, boolean> = {
    programacion_tecnica: false,
    ordenes_compra: false,
    ordenes_servicio: false,
  };
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaThird: PrismaThirdService,
  ) {}

  async onModuleInit() {
    try {
      this.client = new Client({
        node: process.env.ELASTICSEARCH_NODE || 'https://localhost:9200',
        auth: {
          username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
          password: process.env.ELASTICSEARCH_PASSWORD || '',
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
      await this.ensureIndices();
      this.esAvailable = true;

      // Verificar si los índices ya tienen datos (p.ej. tras restart con reindex previo)
      const [ptCount, ocCount, osCount] = await Promise.all([
        this.client.count({ index: 'programacion_tecnica' }),
        this.client.count({ index: 'ordenes_compra' }),
        this.client.count({ index: 'ordenes_servicio' }),
      ]);
      this.esIndexReady.programacion_tecnica = ptCount.count > 0;
      this.esIndexReady.ordenes_compra = ocCount.count > 0;
      this.esIndexReady.ordenes_servicio = osCount.count > 0;

      const hayDatos = Object.values(this.esIndexReady).some(Boolean);
      if (hayDatos) {
        this.logger.log(
          `Elasticsearch conectado con datos (PT:${ptCount.count} OC:${ocCount.count} OS:${osCount.count}) — modo ES activo`,
        );
      } else {
        this.logger.warn(
          'Elasticsearch conectado pero índices vacíos. Búsqueda usa Prisma. Ejecuta POST /api/search/reindex para activar ES.',
        );
      }
    } catch (error) {
      this.logger.warn(
        `Elasticsearch no disponible: ${error.message}. Modo Prisma-only activado.`,
      );
    }
  }

  // ─── Gestión de índices ────────────────────────────────────────────────────

  private async ensureIndices() {
    const indices: Array<{ name: string; mappings: any }> = [
      {
        name: 'programacion_tecnica',
        mappings: {
          properties: {
            id: { type: 'integer' },
            fecha: { type: 'date' },
            proveedor: { type: 'text', analyzer: 'standard' },
            apellidos_nombres: { type: 'text', analyzer: 'standard' },
            proyectos: { type: 'text', analyzer: 'standard' },
            identificador_unico: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            estado_programacion: { type: 'keyword' },
            deleted_at: { type: 'date' },
          },
        },
      },
      {
        name: 'ordenes_compra',
        mappings: {
          properties: {
            id: { type: 'integer' },
            numero_orden: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            nombre_proveedor: { type: 'text', analyzer: 'standard' },
            ruc_proveedor: { type: 'keyword' },
            fecha_orden: { type: 'date' },
            estado: { type: 'keyword' },
            deleted_at: { type: 'date' },
          },
        },
      },
      {
        name: 'ordenes_servicio',
        mappings: {
          properties: {
            id: { type: 'integer' },
            numero_orden: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            nombre_proveedor: { type: 'text', analyzer: 'standard' },
            ruc_proveedor: { type: 'keyword' },
            fecha_orden: { type: 'date' },
            estado: { type: 'keyword' },
            deleted_at: { type: 'date' },
          },
        },
      },
    ];

    for (const index of indices) {
      const exists = await this.client.indices.exists({ index: index.name });
      if (!exists) {
        await this.client.indices.create({
          index: index.name,
          mappings: index.mappings,
        });
        this.logger.log(`Índice creado: ${index.name}`);
      }
    }
  }

  // ─── Métodos públicos ──────────────────────────────────────────────────────

  async indexDoc(
    index: SearchIndex,
    id: string,
    body: Record<string, any>,
  ): Promise<void> {
    if (!this.esAvailable) return;
    try {
      await this.client.index({ index, id, document: body });
      this.esIndexReady[index] = true;
    } catch (error) {
      this.logger.warn(
        `ES indexDoc error (${index}/${id}): ${error.message}`,
      );
    }
  }

  async deleteDoc(index: SearchIndex, id: string): Promise<void> {
    if (!this.esAvailable) return;
    try {
      await this.client.delete({ index, id });
    } catch (error) {
      this.logger.warn(
        `ES deleteDoc error (${index}/${id}): ${error.message}`,
      );
    }
  }

  async search(
    index: SearchIndex,
    q: string,
    page: number,
    limit: number,
  ): Promise<{ data: any[]; total: number }> {
    if (this.esAvailable && this.esIndexReady[index]) {
      try {
        return await this.esSearch(index, q, page, limit);
      } catch (error) {
        this.logger.warn(
          `ES search falló (${index}): ${error.message}. Usando Prisma.`,
        );
      }
    }
    return this.prismaSearch(index, q, page, limit);
  }

  async reindexAll(): Promise<{
    programacion_tecnica: number;
    ordenes_compra: number;
    ordenes_servicio: number;
  }> {
    if (!this.esAvailable) {
      throw new Error('Elasticsearch no está disponible');
    }

    // ── programacion_tecnica ──────────────────────────────────────────────────
    const ptRows = await this.prisma.$queryRaw<any[]>`
      SELECT pt.id, pt.fecha, pt.identificador_unico, pt.estado_programacion, pt.deleted_at,
             c.nombre_chofer, c.apellido_chofer,
             e.razon_social AS empresa_razon_social,
             p.nombre AS nombre_proyecto,
             sp.nombre AS nombre_subproyecto
      FROM programacion_tecnica pt
      LEFT JOIN camiones c ON pt.unidad = c.id_camion
      LEFT JOIN empresas_2025 e
             ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
      LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
      LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
    `;

    const ptOps = ptRows.flatMap((pt) => {
      const nombreCompleto = [
        this.capitalizeWords(pt.nombre_chofer),
        this.capitalizeWords(pt.apellido_chofer),
      ]
        .filter(Boolean)
        .join(' ') || null;

      return [
        {
          index: {
            _index: 'programacion_tecnica',
            _id: pt.id.toString(),
          },
        },
        {
          id: pt.id,
          fecha: pt.fecha ? dayjs(pt.fecha).format('YYYY-MM-DD') : null,
          proveedor: pt.empresa_razon_social || null,
          apellidos_nombres: nombreCompleto,
          proyectos: pt.nombre_subproyecto || pt.nombre_proyecto || null,
          identificador_unico: pt.identificador_unico || null,
          estado_programacion: pt.estado_programacion || null,
          deleted_at: pt.deleted_at
            ? dayjs(pt.deleted_at).toISOString()
            : null,
        },
      ];
    });

    if (ptOps.length > 0) {
      await this.client.bulk({ operations: ptOps, refresh: true });
    }

    // ── ordenes_compra ────────────────────────────────────────────────────────
    const ordCompra = await this.prismaThird.ordenes_compra.findMany({
      include: { proveedores: true },
    });

    const ocOps = ordCompra.flatMap((o) => [
      {
        index: {
          _index: 'ordenes_compra',
          _id: o.id_orden_compra.toString(),
        },
      },
      {
        id: o.id_orden_compra,
        numero_orden: o.numero_orden,
        nombre_proveedor: (o as any).proveedores?.nombre_proveedor || null,
        ruc_proveedor: (o as any).proveedores?.ruc || null,
        fecha_orden: o.fecha_orden
          ? dayjs.utc(o.fecha_orden).format('YYYY-MM-DD')
          : null,
        estado: o.estado || null,
        deleted_at: o.deleted_at ? dayjs(o.deleted_at).toISOString() : null,
      },
    ]);

    if (ocOps.length > 0) {
      await this.client.bulk({ operations: ocOps, refresh: true });
    }

    // ── ordenes_servicio ──────────────────────────────────────────────────────
    const ordServicio = await this.prismaThird.ordenes_servicio.findMany({
      include: { proveedores: true },
    });

    const osOps = ordServicio.flatMap((o) => [
      {
        index: {
          _index: 'ordenes_servicio',
          _id: (o as any).id_orden_servicio.toString(),
        },
      },
      {
        id: (o as any).id_orden_servicio,
        numero_orden: (o as any).numero_orden,
        nombre_proveedor: (o as any).proveedores?.nombre_proveedor || null,
        ruc_proveedor: (o as any).proveedores?.ruc || null,
        fecha_orden: (o as any).fecha_orden
          ? dayjs.utc((o as any).fecha_orden).format('YYYY-MM-DD')
          : null,
        estado: (o as any).estado || null,
        deleted_at: (o as any).deleted_at
          ? dayjs((o as any).deleted_at).toISOString()
          : null,
      },
    ]);

    if (osOps.length > 0) {
      await this.client.bulk({ operations: osOps, refresh: true });
    }

    this.esIndexReady.programacion_tecnica = ptRows.length > 0;
    this.esIndexReady.ordenes_compra = ordCompra.length > 0;
    this.esIndexReady.ordenes_servicio = ordServicio.length > 0;
    this.logger.log('Reindex completado — modo ES activado para búsqueda');

    return {
      programacion_tecnica: ptRows.length,
      ordenes_compra: ordCompra.length,
      ordenes_servicio: ordServicio.length,
    };
  }

  // ─── ES search interno ─────────────────────────────────────────────────────

  private async esSearch(
    index: SearchIndex,
    q: string,
    page: number,
    limit: number,
  ): Promise<{ data: any[]; total: number }> {
    const from = (page - 1) * limit;

    const searchFields: Record<SearchIndex, string[]> = {
      programacion_tecnica: [
        'proveedor',
        'apellidos_nombres',
        'proyectos',
        'identificador_unico',
        'estado_programacion',
      ],
      ordenes_compra: [
        'numero_orden',
        'nombre_proveedor',
        'ruc_proveedor',
        'estado',
      ],
      ordenes_servicio: [
        'numero_orden',
        'nombre_proveedor',
        'ruc_proveedor',
        'estado',
      ],
    };

    const sortField: Record<SearchIndex, string> = {
      programacion_tecnica: 'fecha',
      ordenes_compra: 'fecha_orden',
      ordenes_servicio: 'fecha_orden',
    };

    const esQuery: any = q
      ? {
          multi_match: {
            query: q,
            fields: searchFields[index],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        }
      : { match_all: {} };

    const result = await this.client.search({
      index,
      from,
      size: limit,
      query: esQuery,
      sort: [{ [sortField[index]]: { order: 'desc', missing: '_last' } }],
    });

    const hits = result.hits.hits;
    const total =
      typeof result.hits.total === 'number'
        ? result.hits.total
        : (result.hits.total as any)?.value ?? 0;

    if (hits.length === 0) {
      return { data: [], total };
    }

    const ids = hits.map((hit) => parseInt(hit._id as string));
    const data = await this.getFullDataByIds(index, ids);
    return { data, total };
  }

  // ─── Fallback Prisma ───────────────────────────────────────────────────────

  private async prismaSearch(
    index: SearchIndex,
    q: string,
    page: number,
    limit: number,
  ): Promise<{ data: any[]; total: number }> {
    switch (index) {
      case 'programacion_tecnica':
        return this.searchProgramacionTecnica(q, page, limit);
      case 'ordenes_compra':
        return this.searchOrdenesCompra(q, page, limit);
      case 'ordenes_servicio':
        return this.searchOrdenesServicio(q, page, limit);
    }
  }

  private async getFullDataByIds(
    index: SearchIndex,
    ids: number[],
  ): Promise<any[]> {
    switch (index) {
      case 'programacion_tecnica':
        return this.getProgramacionTecnicaByIds(ids);
      case 'ordenes_compra':
        return this.getOrdenesCompraByIds(ids);
      case 'ordenes_servicio':
        return this.getOrdenesServicioByIds(ids);
    }
  }

  // ─── Programación Técnica ──────────────────────────────────────────────────

  private async searchProgramacionTecnica(
    q: string,
    page: number,
    limit: number,
  ) {
    const offset = (page - 1) * limit;

    if (q) {
      const searchParam = `%${q}%`;

      const [countResult, rows] = await Promise.all([
        this.prisma.$queryRaw<[{ total: bigint }]>(
          Prisma.sql`SELECT COUNT(*) AS total
            FROM programacion_tecnica pt
            LEFT JOIN camiones c ON pt.unidad = c.id_camion
            LEFT JOIN empresas_2025 e
                   ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
            LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
            LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
            WHERE (e.razon_social LIKE ${searchParam}
                OR c.nombre_chofer LIKE ${searchParam}
                OR c.apellido_chofer LIKE ${searchParam}
                OR pt.identificador_unico LIKE ${searchParam}
                OR pt.estado_programacion LIKE ${searchParam}
                OR p.nombre LIKE ${searchParam}
                OR sp.nombre LIKE ${searchParam})`,
        ),
        this.prisma.$queryRaw<any[]>(
          Prisma.sql`SELECT pt.*,
              c.placa AS unidad_placa, c.nombre_chofer, c.apellido_chofer,
              e.razon_social AS empresa_razon_social,
              gr.enlace_del_pdf, gr.enlace_del_xml, gr.enlace_del_cdr,
              p.nombre AS nombre_proyecto,
              sp.nombre AS nombre_subproyecto
            FROM programacion_tecnica pt
            LEFT JOIN camiones c ON pt.unidad = c.id_camion
            LEFT JOIN empresas_2025 e
                   ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
            LEFT JOIN guia_remision gr
                   ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
                  AND gr.estado_gre = 'COMPLETADO'
            LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
            LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
            WHERE (e.razon_social LIKE ${searchParam}
                OR c.nombre_chofer LIKE ${searchParam}
                OR c.apellido_chofer LIKE ${searchParam}
                OR pt.identificador_unico LIKE ${searchParam}
                OR pt.estado_programacion LIKE ${searchParam}
                OR p.nombre LIKE ${searchParam}
                OR sp.nombre LIKE ${searchParam})
            ORDER BY pt.fecha DESC
            LIMIT ${limit} OFFSET ${offset}`,
        ),
      ]);

      const total = Number(countResult[0]?.total ?? 0);
      return { data: rows.map((r) => this.mapProgramacionTecnicaRow(r)), total };
    } else {
      // Sin búsqueda: count + datos paginados
      const [countResult, rows] = await Promise.all([
        this.prisma.$queryRaw<[{ total: bigint }]>(
          Prisma.sql`SELECT COUNT(*) AS total FROM programacion_tecnica`,
        ),
        this.prisma.$queryRaw<any[]>(
          Prisma.sql`SELECT pt.*,
              c.placa AS unidad_placa, c.nombre_chofer, c.apellido_chofer,
              e.razon_social AS empresa_razon_social,
              gr.enlace_del_pdf, gr.enlace_del_xml, gr.enlace_del_cdr,
              p.nombre AS nombre_proyecto,
              sp.nombre AS nombre_subproyecto
            FROM programacion_tecnica pt
            LEFT JOIN camiones c ON pt.unidad = c.id_camion
            LEFT JOIN empresas_2025 e
                   ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
            LEFT JOIN guia_remision gr
                   ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
                  AND gr.estado_gre = 'COMPLETADO'
            LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
            LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
            ORDER BY pt.fecha DESC
            LIMIT ${limit} OFFSET ${offset}`,
        ),
      ]);

      const total = Number(countResult[0]?.total ?? 0);
      return { data: rows.map((r) => this.mapProgramacionTecnicaRow(r)), total };
    }
  }

  private async getProgramacionTecnicaByIds(ids: number[]): Promise<any[]> {
    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`SELECT pt.*,
          c.placa AS unidad_placa, c.nombre_chofer, c.apellido_chofer,
          e.razon_social AS empresa_razon_social,
          gr.enlace_del_pdf, gr.enlace_del_xml, gr.enlace_del_cdr,
          p.nombre AS nombre_proyecto,
          sp.nombre AS nombre_subproyecto
        FROM programacion_tecnica pt
        LEFT JOIN camiones c ON pt.unidad = c.id_camion
        LEFT JOIN empresas_2025 e
               ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
        LEFT JOIN guia_remision gr
               ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
              AND gr.estado_gre = 'COMPLETADO'
        LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
        LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
        WHERE pt.id IN (${Prisma.join(ids)})
        ORDER BY pt.fecha DESC`,
    );
    return rows.map((r) => this.mapProgramacionTecnicaRow(r));
  }

  private capitalizeWords(text: string | null): string | null {
    if (!text) return null;
    return text
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private mapProgramacionTecnicaRow(pt: any) {
    const nombreCapitalizado = this.capitalizeWords(pt.nombre_chofer);
    const apellidoCapitalizado = this.capitalizeWords(pt.apellido_chofer);
    const apellidos_nombres =
      nombreCapitalizado && apellidoCapitalizado
        ? `${nombreCapitalizado} ${apellidoCapitalizado}`
        : null;

    let proyectos: string | null = null;
    let tipo_proyecto: 'proyecto' | 'subproyecto' | null = null;
    if (pt.nombre_subproyecto) {
      proyectos = pt.nombre_subproyecto;
      tipo_proyecto = 'subproyecto';
    } else if (pt.nombre_proyecto) {
      proyectos = pt.nombre_proyecto;
      tipo_proyecto = 'proyecto';
    }

    let hora_partida: string | null = null;
    if (pt.fecha && pt.hora_partida) {
      try {
        const fechaStr = dayjs(pt.fecha).format('YYYY-MM-DD');
        const horaStr = dayjs(pt.hora_partida).format('HH:mm:ss');
        hora_partida = dayjs
          .tz(
            `${fechaStr} ${horaStr}`,
            'YYYY-MM-DD HH:mm:ss',
            'America/Lima',
          )
          .toISOString();
      } catch {
        hora_partida = pt.hora_partida;
      }
    }

    return {
      id: pt.id,
      fecha: pt.fecha,
      unidad: pt.unidad_placa || null,
      proveedor: pt.empresa_razon_social || null,
      apellidos_nombres,
      proyectos,
      tipo_proyecto,
      programacion: pt.programacion,
      hora_partida,
      estado_programacion: pt.estado_programacion,
      comentarios: pt.comentarios,
      validacion: pt.validacion,
      identificador_unico: pt.identificador_unico,
      km_del_dia: pt.km_del_dia,
      mes: pt.mes,
      num_semana: pt.num_semana,
      m3: pt.m3 ? pt.m3.toString() : null,
      cantidad_viaje: pt.cantidad_viaje,
      enlace_del_pdf: pt.enlace_del_pdf || null,
      enlace_del_xml: pt.enlace_del_xml || null,
      enlace_del_cdr: pt.enlace_del_cdr || null,
      deleted_at: pt.deleted_at || null,
    };
  }

  // ─── Órdenes de Compra ─────────────────────────────────────────────────────

  private async searchOrdenesCompra(q: string, page: number, limit: number) {
    const where: any = q
      ? {
          OR: [
            { numero_orden: { contains: q } },
            { estado: { contains: q } },
            { proveedores: { nombre_proveedor: { contains: q } } },
            { proveedores: { ruc: { contains: q } } },
          ],
        }
      : {};

    const [total, ordenes] = await Promise.all([
      this.prismaThird.ordenes_compra.count({ where }),
      this.prismaThird.ordenes_compra.findMany({
        where,
        orderBy: { fecha_registro: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          proveedores: true,
          detalles_orden_compra: true,
          camiones: true,
        },
      }),
    ]);

    return { data: ordenes.map((o) => this.mapOrdenCompra(o)), total };
  }

  private async getOrdenesCompraByIds(ids: number[]): Promise<any[]> {
    const ordenes = await this.prismaThird.ordenes_compra.findMany({
      where: { id_orden_compra: { in: ids } },
      orderBy: { fecha_registro: 'desc' },
      include: {
        proveedores: true,
        detalles_orden_compra: true,
        camiones: true,
      },
    });
    return ordenes.map((o) => this.mapOrdenCompra(o));
  }

  private mapOrdenCompra(orden: any) {
    return {
      ...orden,
      fecha_orden: orden.fecha_orden
        ? dayjs.utc(orden.fecha_orden).format('YYYY-MM-DD')
        : null,
      fecha_registro: orden.fecha_registro
        ? dayjs.utc(orden.fecha_registro).format('YYYY-MM-DD')
        : null,
      nombre_proveedor: orden.proveedores?.nombre_proveedor || null,
      ruc_proveedor: orden.proveedores?.ruc || null,
      items: orden.detalles_orden_compra || [],
      unidad_id: orden.id_camion || null,
      placa_unidad: orden.camiones?.placa || null,
      tipo_unidad: orden.camiones?.tipo || null,
      nombre_chofer: orden.camiones?.nombre_chofer || null,
      apellido_chofer: orden.camiones?.apellido_chofer || null,
    };
  }

  // ─── Órdenes de Servicio ───────────────────────────────────────────────────

  private async searchOrdenesServicio(q: string, page: number, limit: number) {
    const where: any = q
      ? {
          OR: [
            { numero_orden: { contains: q } },
            { estado: { contains: q } },
            { proveedores: { nombre_proveedor: { contains: q } } },
            { proveedores: { ruc: { contains: q } } },
          ],
        }
      : {};

    const [total, ordenes] = await Promise.all([
      this.prismaThird.ordenes_servicio.count({ where }),
      this.prismaThird.ordenes_servicio.findMany({
        where,
        orderBy: { fecha_registro: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          proveedores: true,
          detalles_orden_servicio: true,
          camiones: true,
        },
      }),
    ]);

    return { data: ordenes.map((o) => this.mapOrdenServicio(o)), total };
  }

  private async getOrdenesServicioByIds(ids: number[]): Promise<any[]> {
    const ordenes = await this.prismaThird.ordenes_servicio.findMany({
      where: { id_orden_servicio: { in: ids } },
      orderBy: { fecha_registro: 'desc' },
      include: {
        proveedores: true,
        detalles_orden_servicio: true,
        camiones: true,
      },
    });
    return ordenes.map((o) => this.mapOrdenServicio(o));
  }

  private mapOrdenServicio(orden: any) {
    return {
      ...orden,
      fecha_orden: orden.fecha_orden
        ? dayjs.utc(orden.fecha_orden).format('YYYY-MM-DD')
        : null,
      fecha_registro: orden.fecha_registro
        ? dayjs.utc(orden.fecha_registro).format('YYYY-MM-DD')
        : null,
      nombre_proveedor: orden.proveedores?.nombre_proveedor || null,
      ruc_proveedor: orden.proveedores?.ruc || null,
      items: orden.detalles_orden_servicio || [],
      unidad_id: orden.id_camion || null,
      placa_unidad: orden.camiones?.placa || null,
      tipo_unidad: orden.camiones?.tipo || null,
      nombre_chofer: orden.camiones?.nombre_chofer || null,
      apellido_chofer: orden.camiones?.apellido_chofer || null,
    };
  }
}
