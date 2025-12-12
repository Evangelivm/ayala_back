import { z } from 'zod';

// Schema para la respuesta de NUBEFACT al generar comprobante
export const NubefactGenerarResponseSchema = z.object({
  errors: z.string().optional(),
  aceptada_por_sunat: z.boolean(),
  sunat_description: z.string().optional(),
  sunat_note: z.string().optional(),
  sunat_responsecode: z.string().optional(),
  sunat_soap_error: z.string().optional(),
  pdf_zip_base64: z.string().optional(),
  xml_zip_base64: z.string().optional(),
  cdr_zip_base64: z.string().optional(),
  enlace: z.string().optional(),
  enlace_del_pdf: z.string().optional(),
  enlace_del_xml: z.string().optional(),
  enlace_del_cdr: z.string().optional(),
  cadena_para_codigo_qr: z.string().optional(),
  codigo_hash: z.string().optional(),
});

// Schema para la respuesta de NUBEFACT al consultar comprobante
export const NubefactConsultarResponseSchema = z.object({
  errors: z.string().optional(),
  aceptada_por_sunat: z.boolean(),
  sunat_description: z.string().optional(),
  sunat_note: z.string().optional(),
  sunat_responsecode: z.string().optional(),
  sunat_soap_error: z.string().optional(),
  enlace: z.string().optional(),
  enlace_del_pdf: z.string().optional(),
  enlace_del_xml: z.string().optional(),
  enlace_del_cdr: z.string().optional(),
  cadena_para_codigo_qr: z.string().optional(),
  codigo_hash: z.string().optional(),
});

// Schema para errores de NUBEFACT
export const NubefactErrorSchema = z.object({
  codigo: z.number().int().optional(),
  mensaje: z.string(),
  errors: z.string().optional(),
});

// Tipos inferidos
export type NubefactGenerarResponseDto = z.infer<
  typeof NubefactGenerarResponseSchema
>;
export type NubefactConsultarResponseDto = z.infer<
  typeof NubefactConsultarResponseSchema
>;
export type NubefactErrorDto = z.infer<typeof NubefactErrorSchema>;

// Códigos de error de NUBEFACT (según documentación)
export enum NubefactErrorCode {
  // Errores de autenticación (10-19)
  TOKEN_INVALIDO = 10,
  TOKEN_NO_AUTORIZADO = 11,

  // Errores de validación (20-39)
  PARAMETROS_INVALIDOS = 20,
  SERIE_INVALIDA = 21,
  NUMERO_DUPLICADO = 22,
  RUC_INVALIDO = 23,
  MONTOS_INVALIDOS = 24,
  ITEMS_INVALIDOS = 25,

  // Errores de SUNAT (40-49)
  RECHAZADO_POR_SUNAT = 40,
  TIMEOUT_SUNAT = 41,
  ERROR_COMUNICACION_SUNAT = 42,

  // Errores de sistema (50-59)
  ERROR_INTERNO = 50,
  SERVICIO_NO_DISPONIBLE = 51,
}

// Mapeo de códigos de error
export const NubefactErrorMessages: Record<NubefactErrorCode, string> = {
  [NubefactErrorCode.TOKEN_INVALIDO]: 'Token de autenticación inválido',
  [NubefactErrorCode.TOKEN_NO_AUTORIZADO]: 'Token no autorizado',
  [NubefactErrorCode.PARAMETROS_INVALIDOS]: 'Parámetros inválidos',
  [NubefactErrorCode.SERIE_INVALIDA]: 'Serie inválida',
  [NubefactErrorCode.NUMERO_DUPLICADO]: 'Número de comprobante duplicado',
  [NubefactErrorCode.RUC_INVALIDO]: 'RUC inválido',
  [NubefactErrorCode.MONTOS_INVALIDOS]: 'Montos inválidos',
  [NubefactErrorCode.ITEMS_INVALIDOS]: 'Items inválidos',
  [NubefactErrorCode.RECHAZADO_POR_SUNAT]: 'Rechazado por SUNAT',
  [NubefactErrorCode.TIMEOUT_SUNAT]: 'Timeout en SUNAT',
  [NubefactErrorCode.ERROR_COMUNICACION_SUNAT]: 'Error de comunicación con SUNAT',
  [NubefactErrorCode.ERROR_INTERNO]: 'Error interno de NUBEFACT',
  [NubefactErrorCode.SERVICIO_NO_DISPONIBLE]: 'Servicio no disponible',
};
