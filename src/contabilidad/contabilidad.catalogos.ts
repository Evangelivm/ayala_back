// Datos de los catálogos de referencia extraídos de la hoja "TABLAS" del
// archivo F_Importacion_ModImportacion_ModContabilidad_Contabilidad.xlsm
// (ver ESPECIFICACION_IMPORTACION_CONTABILIDAD.txt, sección 5). Se
// modelan como tablas propias en BD (cat_modulo, cat_fuente, etc. en
// prisma_third/schema.prisma) para poder administrarlas a futuro sin
// requerir un deploy de backend; estas constantes son solo la data
// semilla inicial (ver seed-catalogos.ts).

export interface OpcionCatalogo {
  codigo: string;
  descripcion: string;
}

// TABLA 1 — MODULO
export const TABLA_MODULO: OpcionCatalogo[] = [
  { codigo: '01', descripcion: 'MODULO VENTA' },
  { codigo: '02', descripcion: 'MODULO COMPRAS' },
  { codigo: '03', descripcion: 'MODULO CONTABILIDAD' },
  { codigo: '04', descripcion: 'MODULO TESORERIA' },
  { codigo: '05', descripcion: 'MODULO ALMACEN' },
  { codigo: '08', descripcion: 'MODULO CANJE DE LETRAS POR PAGAR' },
  { codigo: '09', descripcion: 'MODULO CANJE DE LETRAS POR COBRAR' },
  { codigo: '11', descripcion: 'MODULO PRODUCCION' },
  { codigo: '12', descripcion: 'MODULO IMPORTACION' },
  { codigo: '13', descripcion: 'MODULO FABRICACION' },
  { codigo: '14', descripcion: 'MODULO LIQUIDACION DE FONDOS' },
  { codigo: '15', descripcion: 'MODULO PLANILLA' },
  { codigo: '16', descripcion: 'MODULO ACTIVOS FIJOS' },
  { codigo: '17', descripcion: 'MODULO PROCESO COMPRA' },
];

// TABLA 2 — FUENTE
// Nota (sección 6.5 del spec): el código "CB" aparece duplicado en el
// Excel original. Se conserva un único valor "CB" acá; confirmar con el
// negocio si había una distinción no documentada.
export const TABLA_FUENTE: OpcionCatalogo[] = [
  { codigo: 'CB', descripcion: 'CAJA BANCOS' },
  { codigo: 'LD', descripcion: 'LIBRO DIARIO' },
  { codigo: 'RC', descripcion: 'REGISTRO DE COMPRAS' },
  { codigo: 'RV', descripcion: 'REGISTRO DE VENTAS' },
];

// TABLA 3 — MONEDA
export const TABLA_MONEDA: OpcionCatalogo[] = [
  { codigo: '01', descripcion: 'Nuevos Soles' },
  { codigo: '02', descripcion: 'Dólares Américanos' },
];

// TABLA 4 — TIPO DE DOCUMENTO DE IDENTIDAD
export const TABLA_TIPO_DOC_IDENTIDAD: OpcionCatalogo[] = [
  { codigo: '9', descripcion: 'CARNET' },
  { codigo: '00', descripcion: 'OTROS TIPOS DE DOCUMENTOS' },
  { codigo: '01', descripcion: 'DOCUMENTO NACIONAL DE IDENTIDAD' },
  { codigo: '02', descripcion: 'CIP' },
  { codigo: '03', descripcion: 'PLACAS AUTOMOTRIZ' },
  { codigo: '04', descripcion: 'CARNET DE EXTRANJERIA' },
  { codigo: '05', descripcion: 'PLACA DE REGISTRO' },
  { codigo: '06', descripcion: 'REGISTRO UNICO DE CONTRIBUYENTES' },
  { codigo: '07', descripcion: 'PASAPORTE' },
  { codigo: '08', descripcion: 'AGENTES' },
  { codigo: '09', descripcion: 'LOTE' },
  { codigo: '10', descripcion: 'NO DOMICILIADOS' },
  { codigo: '11', descripcion: 'NUMERO DE IDENTIFICACION TRIBUTARIA' },
  { codigo: '12', descripcion: 'CLAVE UNICA DE IDENTIFICACION TRIBUTARIA' },
  { codigo: '13', descripcion: 'BANCOS' },
];

// TABLA 5 — rotulada "(FUENTE)" en el Excel original pero contiene datos
// de FORMA DE PAGO (referenciada por "Cod. Forma Pago/Cobro", no por
// "Fuente" — ver sección 6.5). Renombrada acá para evitar confusión.
export const TABLA_FORMA_PAGO: OpcionCatalogo[] = [
  { codigo: '01', descripcion: 'CONTADO' },
  { codigo: '02', descripcion: 'CREDITO' },
  { codigo: '03', descripcion: 'LETRA' },
];

// TABLA 6 — MEDIO PAGO
export const TABLA_MEDIO_PAGO: OpcionCatalogo[] = [
  { codigo: '001', descripcion: 'Depósito en cuenta' },
  { codigo: '002', descripcion: 'Giro' },
  { codigo: '003', descripcion: 'Transferencia de Fondos' },
  { codigo: '004', descripcion: 'Orden de Pago' },
  { codigo: '005', descripcion: 'Tarjeta de Débito' },
  { codigo: '006', descripcion: 'Tarjeta de Credito' },
  {
    codigo: '007',
    descripcion:
      'Cheques con la clausula de "no negociable","Instrasferibles","No a la orden" u otra equivalente, a que se refiere el inciso F) del articulo 5° del Decreto Legislativo',
  },
  {
    codigo: '008',
    descripcion:
      'Efectivo, por operaciones en las que no existe obligación de utilizar medios de pago',
  },
  { codigo: '009', descripcion: 'Efectivo, en los demas casos' },
  { codigo: '010', descripcion: 'Medios de pago de comercio exterior' },
  { codigo: '011', descripcion: 'Letra de cambio' },
  { codigo: '101', descripcion: 'Transferencias - Comercio Exterior' },
  { codigo: '102', descripcion: 'Cheques bancarios - Comercio Exterior' },
  { codigo: '103', descripcion: 'Orden de Pago Simple - Comercio Exterior' },
  {
    codigo: '104',
    descripcion: 'Orden de Pago Documentario - Comercio Exterior',
  },
  { codigo: '105', descripcion: 'Remesa Simple - Comercio Exterior' },
  { codigo: '106', descripcion: 'Remesa Documentaria - Comercio Exterior' },
  { codigo: '107', descripcion: 'Carta de Crédito Simple - Comercio Exterior' },
  {
    codigo: '108',
    descripcion: 'Carta de Crédito Documentario - Comercio Exterior',
  },
];

// TABLA 7 — Indicador Afecto
export const TABLA_INDICADOR_AFECTO: OpcionCatalogo[] = [
  {
    codigo: 'S',
    descripcion: 'Adquisiciones Gravadas destinadas a Operaciones Gravadas',
  },
  {
    codigo: 'E',
    descripcion:
      'Adquisiciones Gravadas destinadas a Operaciones Gravadas y No Gravadas',
  },
  {
    codigo: 'C',
    descripcion: 'Adquisiciones Gravadas destinadas a No Gravadas',
  },
  { codigo: 'F', descripcion: 'Operaciones que no dan Credido Fiscal' },
  { codigo: 'N', descripcion: 'Operaciones No Gravadas' },
  { codigo: 'O', descripcion: 'Otros' },
  { codigo: 'X', descripcion: 'Operaciones SIN REGISTRO en libro RC' },
];

// TABLA 8 — Concepto Flujo Efectivo Contable
export const TABLA_CONCEPTO_FLUJO_EFECTIVO: OpcionCatalogo[] = [
  { codigo: '1', descripcion: 'OPERACIÓN' },
  { codigo: '2', descripcion: 'INVERSIÓN' },
  { codigo: '3', descripcion: 'FINANCIACIÓN' },
];

// Usado únicamente para sembrar las tablas cat_* (ver seed-catalogos.ts).
// La validación en runtime consulta la BD directamente
// (contabilidad.service.ts#getCodigosCatalogos), no estas constantes.
export const CATALOGOS_SEED = {
  cat_modulo: TABLA_MODULO,
  cat_fuente: TABLA_FUENTE,
  cat_moneda: TABLA_MONEDA,
  cat_tipo_doc_identidad: TABLA_TIPO_DOC_IDENTIDAD,
  cat_forma_pago: TABLA_FORMA_PAGO,
  cat_medio_pago: TABLA_MEDIO_PAGO,
  cat_indicador_afecto: TABLA_INDICADOR_AFECTO,
  cat_concepto_flujo_efectivo: TABLA_CONCEPTO_FLUJO_EFECTIVO,
};
