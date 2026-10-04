import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@generated/prisma-third/client';
import { PrismaThirdService } from '../prisma/prisma-third.service';

export type TipoOrden = 'compra' | 'servicio';

export interface NumeroOrden {
  serie: string;
  nroDoc: string;
  numero_orden_completo: string;
}

export interface NumeroRenovado extends NumeroOrden {
  anterior: string;
  cambiado: boolean;
}

// Cliente de BD: sirve tanto el PrismaService como un cliente de transacción
type Db = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

const TABLAS: Record<TipoOrden, { tabla: string; idCol: string }> = {
  compra: { tabla: 'ordenes_compra', idCol: 'id_orden_compra' },
  servicio: { tabla: 'ordenes_servicio', idCol: 'id_orden_servicio' },
};

// Una reserva vence si el navegador no la renueva (latido cada ~60 s)
const TTL_MINUTOS = 3;
const MAX_REINTENTOS = 8;

/**
 * Reserva de números de orden en el servidor.
 *
 * Las reservas evitan que dos formularios abiertos muestren el mismo número,
 * pero NO son la garantía final: la unicidad real la da el UNIQUE de
 * `numero_orden`. Si al guardar la reserva ya no es válida, el número se
 * reasigna automáticamente (ver prepararNumeroParaGuardar) en vez de fallar.
 */
@Injectable()
export class NumeracionOrdenService {
  constructor(private readonly prismaThird: PrismaThirdService) {}

  // ---------------------------------------------------------------- helpers

  private cfg(tipo: string) {
    const c = TABLAS[tipo as TipoOrden];
    if (!c) throw new BadRequestException(`Tipo de orden inválido: ${tipo}`);
    return c;
  }

  private formatear(serie: string, nro: number): NumeroOrden {
    const nroDoc = nro.toString().padStart(5, '0');
    return { serie, nroDoc, numero_orden_completo: `${serie}-${nroDoc}` };
  }

  private parsear(numero: string): { serie: string; nro: number } | null {
    const partes = (numero || '').split('-');
    if (partes.length !== 2) return null;
    const nro = parseInt(partes[1], 10);
    if (!partes[0] || isNaN(nro)) return null;
    return { serie: partes[0], nro };
  }

  private esConflicto(error: any): boolean {
    const txt = `${error?.message ?? ''} ${JSON.stringify(error?.meta ?? {})}`;
    return (
      error?.code === 'P2002' ||
      error?.code === 'P2034' ||
      /duplicate entry|unique constraint|deadlock|lock wait timeout|1062|1213|1205/i.test(
        txt,
      )
    );
  }

  esViolacionUnica(error: any): boolean {
    return this.esConflicto(error);
  }

  /** Serie y último número de la última orden registrada (mismo criterio que antes) */
  private async baseActual(db: Db, tipo: TipoOrden) {
    const c = this.cfg(tipo);
    const filas = await db.$queryRaw<{ numero_orden: string }[]>`
      SELECT numero_orden FROM ${Prisma.raw(c.tabla)}
      ORDER BY ${Prisma.raw(c.idCol)} DESC LIMIT 1`;
    let serie = '0001';
    let base = 0;
    const p = filas[0] ? this.parsear(filas[0].numero_orden) : null;
    if (p) {
      serie = p.serie;
      base = p.nro;
    }
    return { serie, base };
  }

  private async existeOrden(db: Db, tipo: TipoOrden, numero: string) {
    const c = this.cfg(tipo);
    const filas = await db.$queryRaw<{ x: number }[]>`
      SELECT 1 AS x FROM ${Prisma.raw(c.tabla)}
      WHERE numero_orden = ${numero} LIMIT 1`;
    return filas.length > 0;
  }

  /** Primer número libre: ni usado por una orden ni reservado (vigente) por alguien */
  private async siguienteLibre(db: Db, tipo: TipoOrden): Promise<NumeroOrden> {
    const { serie, base } = await this.baseActual(db, tipo);
    const reservas = await db.$queryRaw<{ nro: number }[]>`
      SELECT nro FROM reservas_numero_orden
      WHERE tipo = ${tipo} AND serie = ${serie} AND nro > ${base}
        AND expira_en >= NOW()`;
    const ocupados = new Set(reservas.map((r) => Number(r.nro)));

    let candidato = base + 1;
    for (let i = 0; i < 5000; i++) {
      if (
        !ocupados.has(candidato) &&
        !(await this.existeOrden(db, tipo, this.formatear(serie, candidato).numero_orden_completo))
      ) {
        break;
      }
      candidato++;
    }
    return this.formatear(serie, candidato);
  }

  private async insertarReserva(
    db: Db,
    tipo: TipoOrden,
    n: NumeroOrden,
    propietario: string,
  ) {
    await db.$executeRaw`
      INSERT INTO reservas_numero_orden (tipo, serie, nro, propietario, expira_en)
      VALUES (${tipo}, ${n.serie}, ${parseInt(n.nroDoc, 10)}, ${propietario},
              DATE_ADD(NOW(), INTERVAL ${Prisma.raw(String(TTL_MINUTOS))} MINUTE))`;
  }

  private async limpiarVencidas() {
    await this.prismaThird.$executeRaw`
      DELETE FROM reservas_numero_orden WHERE expira_en < NOW()`;
  }

  // ---------------------------------------------------------------- API

  /** Reserva el menor número libre para el propietario (un número nuevo por llamada) */
  async reservar(tipo: TipoOrden, propietario: string): Promise<NumeroOrden> {
    this.cfg(tipo);
    await this.limpiarVencidas();

    for (let intento = 1; ; intento++) {
      try {
        return await this.prismaThird.$transaction(
          async (tx) => {
            const n = await this.siguienteLibre(tx, tipo);
            await this.insertarReserva(tx, tipo, n, propietario);
            return n;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
        );
      } catch (error) {
        // Otro usuario reservó el mismo número a la vez: se reintenta con el siguiente
        if (this.esConflicto(error) && intento < MAX_REINTENTOS) continue;
        throw error;
      }
    }
  }

  /**
   * Latido: extiende las reservas del propietario. Si alguna ya no existe
   * (venció, o el servidor se reinició) intenta recuperar el mismo número;
   * si ya lo tomaron, asigna uno nuevo e indica `cambiado: true`.
   */
  async renovar(
    tipo: TipoOrden,
    propietario: string,
    numeros: string[],
  ): Promise<NumeroRenovado[]> {
    this.cfg(tipo);
    const resultado: NumeroRenovado[] = [];

    for (const numero of numeros.slice(0, 50)) {
      const p = this.parsear(numero);
      let vigente: NumeroOrden | null = null;

      if (p) {
        await this.prismaThird.$executeRaw`
          UPDATE reservas_numero_orden
          SET expira_en = DATE_ADD(NOW(), INTERVAL ${Prisma.raw(String(TTL_MINUTOS))} MINUTE)
          WHERE tipo = ${tipo} AND serie = ${p.serie} AND nro = ${p.nro}
            AND propietario = ${propietario}`;
        const sigue = await this.prismaThird.$queryRaw<{ x: number }[]>`
          SELECT 1 AS x FROM reservas_numero_orden
          WHERE tipo = ${tipo} AND serie = ${p.serie} AND nro = ${p.nro}
            AND propietario = ${propietario} LIMIT 1`;

        if (sigue.length > 0) {
          vigente = this.formatear(p.serie, p.nro);
        } else {
          vigente = await this.reclamar(tipo, propietario, p.serie, p.nro);
        }
      }

      if (!vigente) vigente = await this.reservar(tipo, propietario);

      resultado.push({
        ...vigente,
        anterior: numero,
        cambiado: vigente.numero_orden_completo !== numero,
      });
    }
    return resultado;
  }

  /** Intenta volver a tomar un número concreto; null si ya no está disponible */
  private async reclamar(
    tipo: TipoOrden,
    propietario: string,
    serie: string,
    nro: number,
  ): Promise<NumeroOrden | null> {
    const n = this.formatear(serie, nro);
    try {
      await this.limpiarVencidas();
      if (await this.existeOrden(this.prismaThird, tipo, n.numero_orden_completo)) {
        return null;
      }
      await this.insertarReserva(this.prismaThird, tipo, n, propietario);
      return n;
    } catch (error) {
      if (this.esConflicto(error)) return null;
      throw error;
    }
  }

  /** Libera números concretos del propietario, o todos los suyos si no se indican */
  async liberar(tipo: TipoOrden, propietario: string, numeros?: string[]) {
    this.cfg(tipo);
    if (!numeros || numeros.length === 0) {
      await this.prismaThird.$executeRaw`
        DELETE FROM reservas_numero_orden
        WHERE tipo = ${tipo} AND propietario = ${propietario}`;
      return;
    }
    for (const numero of numeros.slice(0, 50)) {
      const p = this.parsear(numero);
      if (!p) continue;
      await this.prismaThird.$executeRaw`
        DELETE FROM reservas_numero_orden
        WHERE tipo = ${tipo} AND serie = ${p.serie} AND nro = ${p.nro}
          AND propietario = ${propietario}`;
    }
  }

  /**
   * Para llamar DENTRO de la transacción que crea la orden. Devuelve el número
   * con el que realmente se debe guardar: el solicitado si sigue siendo válido
   * (no usado y no reservado por otra persona) o el siguiente libre si no.
   */
  async prepararNumeroParaGuardar(
    tx: Db,
    tipo: TipoOrden,
    propietario: string | undefined,
    solicitado: string,
    forzarNuevo = false,
  ): Promise<{ numero_orden: string; reasignado: boolean }> {
    const p = this.parsear(solicitado);
    let valido = !forzarNuevo && !!p;

    if (valido && p) {
      if (await this.existeOrden(tx, tipo, solicitado)) {
        valido = false;
      } else {
        const ajenas = await tx.$queryRaw<{ x: number }[]>`
          SELECT 1 AS x FROM reservas_numero_orden
          WHERE tipo = ${tipo} AND serie = ${p.serie} AND nro = ${p.nro}
            AND expira_en >= NOW() AND propietario <> ${propietario ?? ''}
          LIMIT 1`;
        if (ajenas.length > 0) valido = false;
      }
    }

    if (valido) return { numero_orden: solicitado, reasignado: false };

    const nuevo = await this.siguienteLibre(tx, tipo);
    return { numero_orden: nuevo.numero_orden_completo, reasignado: true };
  }

  /** Para llamar tras crear la orden (misma transacción): borra reservas de esos números */
  async consumirReservas(tx: Db, tipo: TipoOrden, numeros: string[]) {
    for (const numero of numeros) {
      const p = this.parsear(numero);
      if (!p) continue;
      await tx.$executeRaw`
        DELETE FROM reservas_numero_orden
        WHERE tipo = ${tipo} AND serie = ${p.serie} AND nro = ${p.nro}`;
    }
  }
}
