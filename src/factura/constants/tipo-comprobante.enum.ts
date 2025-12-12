// Tipos de comprobante según SUNAT
export enum TipoComprobante {
  FACTURA = 1,
  BOLETA = 2,
  NOTA_CREDITO = 7,
  NOTA_DEBITO = 8,
  RECIBO_HONORARIOS = 9,
  FACTURA_ANTICIPO = 13, // Factura con anticipo
}

// Mapeo de nombres para visualización
export const TipoComprobanteNombres: Record<TipoComprobante, string> = {
  [TipoComprobante.FACTURA]: 'Factura',
  [TipoComprobante.BOLETA]: 'Boleta',
  [TipoComprobante.NOTA_CREDITO]: 'Nota de Crédito',
  [TipoComprobante.NOTA_DEBITO]: 'Nota de Débito',
  [TipoComprobante.RECIBO_HONORARIOS]: 'Recibo por Honorarios',
  [TipoComprobante.FACTURA_ANTICIPO]: 'Factura con Anticipo',
};
