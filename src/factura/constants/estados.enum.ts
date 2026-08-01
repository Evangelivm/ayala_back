// Estados del ciclo de vida de una factura
export enum EstadoFactura {
  NULL = 'NULL', // Recién creada, aún no validada
  PENDIENTE = 'PENDIENTE', // Validada, lista para enviar a NUBEFACT
  PROCESANDO = 'PROCESANDO', // Enviada a NUBEFACT, esperando respuesta
  COMPLETADO = 'COMPLETADO', // Aceptada por SUNAT
  FALLADO = 'FALLADO', // Error en validación o NUBEFACT
  ERROR = 'ERROR', // Falló la consulta de estado a NUBEFACT (ver consultarEnNubefact)
}
