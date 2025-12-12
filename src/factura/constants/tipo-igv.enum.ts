// Tipo de afectación del IGV según catálogo 07 SUNAT
export enum TipoIGV {
  GRAVADO_OPERACION_ONEROSA = 10, // Gravado - Operación Onerosa
  GRAVADO_RETIRO_BONIFICACION = 11, // Gravado - Retiro por premio
  GRAVADO_RETIRO_DONACION = 12, // Gravado - Retiro por donación
  GRAVADO_RETIRO = 13, // Gravado - Retiro
  GRAVADO_RETIRO_PUBLICIDAD = 14, // Gravado - Retiro por publicidad
  GRAVADO_BONIFICACIONES = 15, // Gravado - Bonificaciones
  GRAVADO_RETIRO_ENTREGA_TRABAJADORES = 16, // Gravado - Retiro por entrega a trabajadores
  GRAVADO_IVAP = 17, // Gravado - IVAP
  EXONERADO_OPERACION_ONEROSA = 20, // Exonerado - Operación Onerosa
  EXONERADO_TRANSFERENCIA_GRATUITA = 21, // Exonerado - Transferencia gratuita
  INAFECTO_OPERACION_ONEROSA = 30, // Inafecto - Operación Onerosa
  INAFECTO_RETIRO_BONIFICACION = 31, // Inafecto - Retiro por Bonificación
  INAFECTO_RETIRO = 32, // Inafecto - Retiro
  INAFECTO_RETIRO_MUESTRAS_MEDICAS = 33, // Inafecto - Retiro por Muestras Médicas
  INAFECTO_RETIRO_CONVENIO_COLECTIVO = 34, // Inafecto - Retiro por Convenio Colectivo
  INAFECTO_RETIRO_PREMIO = 35, // Inafecto - Retiro por premio
  INAFECTO_RETIRO_PUBLICIDAD = 36, // Inafecto - Retiro por publicidad
  EXPORTACION = 40, // Exportación
}

// Mapeo de nombres para visualización
export const TipoIGVNombres: Record<TipoIGV, string> = {
  [TipoIGV.GRAVADO_OPERACION_ONEROSA]: 'Gravado - Operación Onerosa',
  [TipoIGV.GRAVADO_RETIRO_BONIFICACION]: 'Gravado - Retiro por premio',
  [TipoIGV.GRAVADO_RETIRO_DONACION]: 'Gravado - Retiro por donación',
  [TipoIGV.GRAVADO_RETIRO]: 'Gravado - Retiro',
  [TipoIGV.GRAVADO_RETIRO_PUBLICIDAD]: 'Gravado - Retiro por publicidad',
  [TipoIGV.GRAVADO_BONIFICACIONES]: 'Gravado - Bonificaciones',
  [TipoIGV.GRAVADO_RETIRO_ENTREGA_TRABAJADORES]:
    'Gravado - Retiro por entrega a trabajadores',
  [TipoIGV.GRAVADO_IVAP]: 'Gravado - IVAP',
  [TipoIGV.EXONERADO_OPERACION_ONEROSA]: 'Exonerado - Operación Onerosa',
  [TipoIGV.EXONERADO_TRANSFERENCIA_GRATUITA]:
    'Exonerado - Transferencia gratuita',
  [TipoIGV.INAFECTO_OPERACION_ONEROSA]: 'Inafecto - Operación Onerosa',
  [TipoIGV.INAFECTO_RETIRO_BONIFICACION]: 'Inafecto - Retiro por Bonificación',
  [TipoIGV.INAFECTO_RETIRO]: 'Inafecto - Retiro',
  [TipoIGV.INAFECTO_RETIRO_MUESTRAS_MEDICAS]:
    'Inafecto - Retiro por Muestras Médicas',
  [TipoIGV.INAFECTO_RETIRO_CONVENIO_COLECTIVO]:
    'Inafecto - Retiro por Convenio Colectivo',
  [TipoIGV.INAFECTO_RETIRO_PREMIO]: 'Inafecto - Retiro por premio',
  [TipoIGV.INAFECTO_RETIRO_PUBLICIDAD]: 'Inafecto - Retiro por publicidad',
  [TipoIGV.EXPORTACION]: 'Exportación',
};
