import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@generated/prisma-third';
import { PrismaThirdService } from '../prisma/prisma-third.service';
import {
  AsientoContableRow,
  CodigosCatalogosContabilidad,
  crearAsientoContableRowSchema,
} from './dto/import-asiento-contable.dto';

export interface FilaValidada {
  fila: number; // índice 1-based dentro del archivo importado
  valida: boolean;
  datos: AsientoContableRow | null;
  errores: string[];
}

export interface ResultadoValidacion {
  totalFilas: number;
  filasValidas: number;
  filasError: number;
  resultados: FilaValidada[];
}

const CA_KEYS = [
  'ca01',
  'ca02',
  'ca03',
  'ca04',
  'ca05',
  'ca06',
  'ca07',
  'ca08',
  'ca09',
  'ca10',
  'ca11',
  'ca12',
  'ca13',
  'ca14',
  'ca15',
] as const;

@Injectable()
export class ContabilidadService {
  constructor(private readonly prismaThird: PrismaThirdService) {}

  /**
   * Catálogos completos (código + descripción), para poblar selects en el
   * frontend. Consultan las tablas cat_* directamente.
   */
  async getCatalogos() {
    const [
      modulo,
      fuente,
      moneda,
      tipoDocIdentidad,
      formaPago,
      medioPago,
      indicadorAfecto,
      conceptoFlujoEfectivo,
    ] = await Promise.all([
      this.prismaThird.cat_modulo.findMany({ orderBy: { codigo: 'asc' } }),
      this.prismaThird.cat_fuente.findMany({ orderBy: { codigo: 'asc' } }),
      this.prismaThird.cat_moneda.findMany({ orderBy: { codigo: 'asc' } }),
      this.prismaThird.cat_tipo_doc_identidad.findMany({
        orderBy: { codigo: 'asc' },
      }),
      this.prismaThird.cat_forma_pago.findMany({ orderBy: { codigo: 'asc' } }),
      this.prismaThird.cat_medio_pago.findMany({ orderBy: { codigo: 'asc' } }),
      this.prismaThird.cat_indicador_afecto.findMany({
        orderBy: { codigo: 'asc' },
      }),
      this.prismaThird.cat_concepto_flujo_efectivo.findMany({
        orderBy: { codigo: 'asc' },
      }),
    ]);

    return {
      modulo,
      fuente,
      moneda,
      tipoDocIdentidad,
      formaPago,
      medioPago,
      indicadorAfecto,
      conceptoFlujoEfectivo,
    };
  }

  /** Solo los códigos válidos de cada catálogo, usados para validar filas. */
  private async getCodigosCatalogos(): Promise<CodigosCatalogosContabilidad> {
    const catalogos = await this.getCatalogos();
    const codigos = (tabla: { codigo: string }[]) => tabla.map((t) => t.codigo);

    return {
      modulo: codigos(catalogos.modulo),
      fuente: codigos(catalogos.fuente),
      moneda: codigos(catalogos.moneda),
      tipoDocIdentidad: codigos(catalogos.tipoDocIdentidad),
      formaPago: codigos(catalogos.formaPago),
      medioPago: codigos(catalogos.medioPago),
      indicadorAfecto: codigos(catalogos.indicadorAfecto),
      conceptoFlujoEfectivo: codigos(catalogos.conceptoFlujoEfectivo),
    };
  }

  /**
   * Valida cada fila contra el schema y los catálogos, sin tocar la BD.
   * Reemplaza el "copiar tal cual sin validar" de la macro original.
   */
  async validarFilas(filas: unknown[]): Promise<ResultadoValidacion> {
    const codigos = await this.getCodigosCatalogos();
    const schema = crearAsientoContableRowSchema(codigos);

    const resultados: FilaValidada[] = filas.map((filaRaw, index) => {
      const parsed = schema.safeParse(filaRaw);

      if (parsed.success) {
        return {
          fila: index + 1,
          valida: true,
          datos: parsed.data,
          errores: [],
        };
      }

      const errores = parsed.error.errors.map(
        (e) => `${e.path.join('.') || 'fila'}: ${e.message}`,
      );

      return { fila: index + 1, valida: false, datos: null, errores };
    });

    const filasValidas = resultados.filter((r) => r.valida).length;

    return {
      totalFilas: resultados.length,
      filasValidas,
      filasError: resultados.length - filasValidas,
      resultados,
    };
  }

  async preview(filas: unknown[]): Promise<ResultadoValidacion> {
    return this.validarFilas(filas);
  }

  /**
   * Confirma la importación: revalida todo en el servidor (nunca confiar
   * solo en la validación del cliente) y, si todas las filas son válidas,
   * inserta el lote completo en una única transacción atómica (sección
   * 6.4 del spec: nada de "borrar todo e insertar de nuevo").
   */
  async confirmarImportacion(
    filas: unknown[],
    nombreArchivo: string | undefined,
    usuarioId?: number,
  ) {
    const validacion = await this.validarFilas(filas);

    if (validacion.filasError > 0) {
      throw new BadRequestException({
        message:
          'La importación contiene filas inválidas. Corrígelas antes de confirmar.',
        ...validacion,
      });
    }

    const filasValidas = validacion.resultados
      .map((r) => r.datos)
      .filter((d): d is AsientoContableRow => d !== null);

    const lote = await this.prismaThird.$transaction(async (tx) => {
      const nuevoLote = await tx.lotes_importacion_contable.create({
        data: {
          nombre_archivo: nombreArchivo || null,
          total_filas: validacion.totalFilas,
          filas_validas: validacion.filasValidas,
          filas_error: validacion.filasError,
          creado_por: usuarioId || null,
        },
      });

      await tx.asientos_contables.createMany({
        data: filasValidas.map((fila) =>
          this.mapRowToPrismaData(fila, nuevoLote.id, usuarioId),
        ),
      });

      return nuevoLote;
    });

    return {
      success: true,
      message: `Lote #${lote.id} importado: ${validacion.filasValidas} asientos contables creados`,
      loteId: lote.id,
      ...validacion,
    };
  }

  private mapRowToPrismaData(
    row: AsientoContableRow,
    idLote: number,
    usuarioId?: number,
  ): Prisma.asientos_contablesCreateManyInput {
    const camposAdicionales: Record<string, string> = {};
    for (const key of CA_KEYS) {
      const valor = row[key];
      if (valor !== undefined && valor !== '') camposAdicionales[key] = valor;
    }

    const fecha = (v?: string) => (v ? new Date(v) : null);

    return {
      id_lote: idLote,
      correlativo: row.correlativo,
      relacionado: row.relacionado,
      codigo_tipo_medio_pago: row.codigo_tipo_medio_pago || null,
      ejercicio: row.ejercicio,
      periodo: row.periodo,
      cod_modulo: row.cod_modulo,
      modulo: row.modulo,
      fuente: row.fuente,
      numero_cuenta: row.numero_cuenta,
      codigo_tipo_documento: row.codigo_tipo_documento || null,
      numero_serie: row.numero_serie || null,
      numero_documento: row.numero_documento || null,
      concepto_fec: row.concepto_fec ?? null,
      glosa: row.glosa || null,
      codigo_moneda_origen: row.codigo_moneda_origen,
      codigo_moneda_registro: row.codigo_moneda_registro,
      codigo_centro_costo: row.codigo_centro_costo,
      codigo_sub_centro_costo: row.codigo_sub_centro_costo,
      codigo_sub_sub_centro_costo: row.codigo_sub_sub_centro_costo,
      codigo_forma_provision: row.codigo_forma_provision || null,
      codigo_forma_pago_cobro: row.codigo_forma_pago_cobro || null,
      codigo_area: row.codigo_area,
      identificador_ctr_mda: row.identificador_ctr_mda || null,
      identificador_tip_afecto: row.identificador_tip_afecto || null,
      nro_cheque: row.nro_cheque || null,
      grdo: row.grdo || null,
      fecha_emision_doc: fecha(row.fecha_emision_doc),
      fecha_vencimiento_doc: fecha(row.fecha_vencimiento_doc),
      fecha_movimiento: fecha(row.fecha_movimiento),
      fecha_cbr: fecha(row.fecha_cbr),
      fecha_registro: fecha(row.fecha_registro),
      fecha_conc: fecha(row.fecha_conc),
      fecha_dif: fecha(row.fecha_dif),
      cod_tip_doc_ident_clt: row.cod_tip_doc_ident_clt || null,
      nro_doc_clt: row.nro_doc_clt || null,
      razon_social_1: row.razon_social_1 || null,
      cod_tip_doc_ident_prov: row.cod_tip_doc_ident_prov || null,
      nro_doc_prov: row.nro_doc_prov || null,
      razon_social_2: row.razon_social_2 || null,
      cod_tip_doc_ident_trab: row.cod_tip_doc_ident_trab || null,
      nro_doc_trab: row.nro_doc_trab || null,
      razon_social_3: row.razon_social_3 || null,
      monto_debe: row.monto_debe,
      monto_haber: row.monto_haber,
      monto_debe_me: row.monto_debe_me ?? null,
      monto_haber_me: row.monto_haber_me ?? null,
      cambio_moneda: row.cambio_moneda,
      es_cancelado: row.es_cancelado ?? false,
      es_conciliado: row.es_conciliado ?? false,
      es_provision: row.es_provision ?? false,
      es_anulado: row.es_anulado ?? false,
      es_destino: row.es_destino ?? false,
      doc_ref_fecha_emision: fecha(row.doc_ref_fecha_emision),
      doc_ref_cod_tip_doc: row.doc_ref_cod_tip_doc || null,
      doc_ref_nro_serie: row.doc_ref_nro_serie || null,
      doc_ref_nro_doc: row.doc_ref_nro_doc || null,
      numero_detraccion: row.numero_detraccion || null,
      fecha_pago_detraccion: row.fecha_pago_detraccion || null,
      campos_adicionales:
        Object.keys(camposAdicionales).length > 0
          ? camposAdicionales
          : undefined,
      creado_por: usuarioId || null,
    };
  }

  async findAll(q: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where: Prisma.asientos_contablesWhereInput = {
      deleted_at: null,
      ...(q
        ? {
            OR: [
              { numero_cuenta: { contains: q } },
              { numero_documento: { contains: q } },
              { glosa: { contains: q } },
              { razon_social_1: { contains: q } },
              { razon_social_2: { contains: q } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prismaThird.$transaction([
      this.prismaThird.asientos_contables.findMany({
        where,
        orderBy: { creado_en: 'desc' },
        skip,
        take: limit,
        include: {
          lote: { select: { nombre_archivo: true, creado_en: true } },
        },
      }),
      this.prismaThird.asientos_contables.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async remove(id: number) {
    const asiento = await this.prismaThird.asientos_contables.findUnique({
      where: { id },
    });
    if (!asiento) {
      throw new BadRequestException(
        `Asiento contable con ID ${id} no encontrado`,
      );
    }
    await this.prismaThird.asientos_contables.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async restore(id: number) {
    const asiento = await this.prismaThird.asientos_contables.findUnique({
      where: { id },
    });
    if (!asiento) {
      throw new BadRequestException(
        `Asiento contable con ID ${id} no encontrado`,
      );
    }
    await this.prismaThird.asientos_contables.update({
      where: { id },
      data: { deleted_at: null },
    });
  }
}
