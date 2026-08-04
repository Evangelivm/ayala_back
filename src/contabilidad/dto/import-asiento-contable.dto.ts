import { z } from 'zod';

// Códigos válidos por catálogo, consultados en runtime desde las tablas
// cat_* (ver contabilidad.service.ts#getCodigosCatalogos). Se pasan como
// parámetro al armar el schema porque el listado de códigos vive en BD,
// no en el código.
export interface CodigosCatalogosContabilidad {
  modulo: string[];
  fuente: string[];
  moneda: string[];
  tipoDocIdentidad: string[];
  formaPago: string[];
  medioPago: string[];
  indicadorAfecto: string[];
  conceptoFlujoEfectivo: string[];
}

// Convierte '' / null / undefined en undefined para que .optional() aplique.
const vacioComoUndefined = (v: unknown) =>
  v === '' || v === null || v === undefined ? undefined : v;

const textoOpcional = (max: number) =>
  z.preprocess(vacioComoUndefined, z.string().max(max)).optional();

const fechaOpcional = () =>
  z
    .preprocess(
      vacioComoUndefined,
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
    )
    .optional();

const codigoCatalogoOpcional = (codigos: string[], nombreTabla: string) =>
  z
    .preprocess(
      vacioComoUndefined,
      z.string().refine((v) => codigos.includes(v), {
        message: `Código no encontrado en ${nombreTabla}`,
      }),
    )
    .optional();

const codigoCatalogoRequerido = (codigos: string[], nombreTabla: string) =>
  z.string().refine((v) => codigos.includes(v), {
    message: `Código no encontrado en ${nombreTabla}`,
  });

const booleanoFlexible = () =>
  z
    .preprocess((v) => {
      if (v === '' || v === null || v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v === 1;
      if (typeof v === 'string') return v === '1' || v.toUpperCase() === 'SI';
      return v;
    }, z.boolean())
    .optional();

// Una fila = una línea debe/haber del voucher (columnas D:BX de la hoja
// CONTABILIDAD, sección 3 de ESPECIFICACION_IMPORTACION_CONTABILIDAD.txt).
export function crearAsientoContableRowSchema(
  codigos: CodigosCatalogosContabilidad,
) {
  return z
    .object({
      // Información general
      correlativo: z.coerce.number().int('Correlativo debe ser entero'),
      relacionado: z.coerce.number().int('Relacionado debe ser entero'),
      codigo_tipo_medio_pago: codigoCatalogoOpcional(
        codigos.medioPago,
        'Tabla Medio Pago',
      ),
      ejercicio: z.string().length(4, 'Ejercicio debe tener 4 dígitos'),
      periodo: z.string().length(2, 'Periodo debe tener 2 dígitos'),
      cod_modulo: codigoCatalogoRequerido(codigos.modulo, 'Tabla Módulo'),
      modulo: z.string().min(1).max(4),
      fuente: codigoCatalogoRequerido(codigos.fuente, 'Tabla Fuente'),
      numero_cuenta: z.string().min(1, 'Número de cuenta es requerido').max(50),
      codigo_tipo_documento: textoOpcional(2),
      numero_serie: textoOpcional(20),
      numero_documento: textoOpcional(20),
      concepto_fec: z
        .preprocess(
          vacioComoUndefined,
          z.coerce
            .number()
            .int()
            .refine((v) => codigos.conceptoFlujoEfectivo.includes(String(v)), {
              message: 'Código no encontrado en Tabla Concepto Flujo Efectivo',
            }),
        )
        .optional(),
      glosa: textoOpcional(500),
      codigo_moneda_origen: codigoCatalogoRequerido(
        codigos.moneda,
        'Tabla Moneda',
      ),
      codigo_moneda_registro: codigoCatalogoRequerido(
        codigos.moneda,
        'Tabla Moneda',
      ),
      codigo_centro_costo: z.string().min(1).max(8),
      codigo_sub_centro_costo: z.string().min(1).max(8),
      codigo_sub_sub_centro_costo: z.string().min(1).max(8),
      codigo_forma_provision: textoOpcional(2),
      codigo_forma_pago_cobro: codigoCatalogoOpcional(
        codigos.formaPago,
        'Tabla Forma de Pago',
      ),
      codigo_area: z.string().min(1).max(6),
      identificador_ctr_mda: textoOpcional(1),
      identificador_tip_afecto: codigoCatalogoOpcional(
        codigos.indicadorAfecto,
        'Tabla Indicador Afecto',
      ),
      nro_cheque: textoOpcional(30),
      grdo: textoOpcional(100),

      // Fechas
      fecha_emision_doc: fechaOpcional(),
      fecha_vencimiento_doc: fechaOpcional(),
      fecha_movimiento: fechaOpcional(),
      fecha_cbr: fechaOpcional(),
      fecha_registro: fechaOpcional(),
      fecha_conc: fechaOpcional(),
      fecha_dif: fechaOpcional(),

      // Auxiliares: Cliente / Proveedor / Trabajador
      cod_tip_doc_ident_clt: codigoCatalogoOpcional(
        codigos.tipoDocIdentidad,
        'Tabla Tipo Doc. Identidad',
      ),
      nro_doc_clt: textoOpcional(10),
      razon_social_1: textoOpcional(800),
      cod_tip_doc_ident_prov: codigoCatalogoOpcional(
        codigos.tipoDocIdentidad,
        'Tabla Tipo Doc. Identidad',
      ),
      nro_doc_prov: textoOpcional(10),
      razon_social_2: textoOpcional(800),
      cod_tip_doc_ident_trab: codigoCatalogoOpcional(
        codigos.tipoDocIdentidad,
        'Tabla Tipo Doc. Identidad',
      ),
      nro_doc_trab: textoOpcional(10),
      razon_social_3: textoOpcional(800),

      // Cantidades
      monto_debe: z.coerce
        .number()
        .nonnegative('Monto Debe no puede ser negativo'),
      monto_haber: z.coerce
        .number()
        .nonnegative('Monto Haber no puede ser negativo'),
      monto_debe_me: z
        .preprocess(vacioComoUndefined, z.coerce.number())
        .optional(),
      monto_haber_me: z
        .preprocess(vacioComoUndefined, z.coerce.number())
        .optional(),
      cambio_moneda: z.coerce.number().nonnegative(),

      // Indicadores
      es_cancelado: booleanoFlexible(),
      es_conciliado: booleanoFlexible(),
      es_provision: booleanoFlexible(),
      es_anulado: booleanoFlexible(),
      es_destino: booleanoFlexible(),

      // Documento de referencia
      doc_ref_fecha_emision: fechaOpcional(),
      doc_ref_cod_tip_doc: textoOpcional(2),
      doc_ref_nro_serie: textoOpcional(4),
      doc_ref_nro_doc: textoOpcional(8),
      numero_detraccion: textoOpcional(8),
      fecha_pago_detraccion: textoOpcional(8),

      // Campos adicionales de uso libre (CA01..CA15)
      ca01: textoOpcional(4000),
      ca02: textoOpcional(4000),
      ca03: textoOpcional(4000),
      ca04: textoOpcional(4000),
      ca05: textoOpcional(4000),
      ca06: textoOpcional(4000),
      ca07: textoOpcional(4000),
      ca08: textoOpcional(4000),
      ca09: textoOpcional(4000),
      ca10: textoOpcional(4000),
      ca11: textoOpcional(4000),
      ca12: textoOpcional(4000),
      ca13: textoOpcional(4000),
      ca14: textoOpcional(4000),
      ca15: textoOpcional(4000),
    })
    .strip();
}

export type AsientoContableRow = z.infer<
  ReturnType<typeof crearAsientoContableRowSchema>
>;

export const ImportContabilidadSchema = z.object({
  nombreArchivo: z.string().optional(),
  usuarioId: z.number().int().positive().optional(),
  filas: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, 'No hay filas para procesar'),
});

export type ImportContabilidadDto = z.infer<typeof ImportContabilidadSchema>;
