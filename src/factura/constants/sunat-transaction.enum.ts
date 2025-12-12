// Tipo de transacción según SUNAT
export enum SunatTransaction {
  VENTA_INTERNA = 1, // Venta interna
  EXPORTACION = 2, // Exportación
  NO_DOMICILIADO = 3, // Venta a no domiciliado
  VENTA_INTERNA_ANTICIPADA = 4, // Venta interna anticipada
  ITINERANTE = 5, // Venta itinerante
  GUIA_REMISION_IMPORTACION = 6, // Factura - Guía remisión
  VENTA_ARROZ_PILADO = 7, // Venta arroz pilado
  FACTURA_COMPROBANTE_PERCEPCION = 8, // Factura - Comprobante de Percepción
  FACTURA_GUIA_BIENES_PUBLICOS = 9, // Factura - Guía Remisión - Bienes del Estado
  VENTA_INMUEBLES = 10, // Venta de inmuebles
}

// Mapeo de nombres para visualización
export const SunatTransactionNombres: Record<SunatTransaction, string> = {
  [SunatTransaction.VENTA_INTERNA]: 'Venta Interna',
  [SunatTransaction.EXPORTACION]: 'Exportación',
  [SunatTransaction.NO_DOMICILIADO]: 'Venta a No Domiciliado',
  [SunatTransaction.VENTA_INTERNA_ANTICIPADA]: 'Venta Interna Anticipada',
  [SunatTransaction.ITINERANTE]: 'Venta Itinerante',
  [SunatTransaction.GUIA_REMISION_IMPORTACION]: 'Factura - Guía Remisión',
  [SunatTransaction.VENTA_ARROZ_PILADO]: 'Venta Arroz Pilado',
  [SunatTransaction.FACTURA_COMPROBANTE_PERCEPCION]:
    'Factura - Comprobante de Percepción',
  [SunatTransaction.FACTURA_GUIA_BIENES_PUBLICOS]:
    'Factura - Guía Remisión - Bienes del Estado',
  [SunatTransaction.VENTA_INMUEBLES]: 'Venta de Inmuebles',
};
