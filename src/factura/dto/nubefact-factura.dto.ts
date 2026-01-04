import { z } from 'zod';

// Schema para item en formato NUBEFACT
export const NubefactFacturaItemSchema = z.object({
  unidad_de_medida: z.string(),
  codigo: z.string().optional(),
  codigo_producto_sunat: z.string().optional(),
  descripcion: z.string(),
  cantidad: z.number(),
  valor_unitario: z.number(),
  precio_unitario: z.number(),
  descuento: z.number().optional(),
  subtotal: z.number(),
  tipo_de_igv: z.number().int(),
  igv: z.number(),
  tipo_de_isc: z.number().int().optional(),
  isc: z.number().optional(),
  total: z.number(),
  anticipo_regularizacion: z.boolean().optional(),
  anticipo_comprobante_serie: z.string().optional(),
  anticipo_comprobante_numero: z.number().int().optional(),
});

// Schema para guía en formato NUBEFACT
export const NubefactFacturaGuiaSchema = z.object({
  guia_tipo: z.number().int(),
  guia_serie_numero: z.string(),
});

// Schema para venta a crédito en formato NUBEFACT
export const NubefactFacturaVentaCreditoSchema = z.object({
  cuota: z.number().int(),
  fecha_de_pago: z.string(), // Formato DD-MM-YYYY
  importe: z.number(),
});

// Schema principal para factura en formato NUBEFACT
export const NubefactFacturaSchema = z.object({
  // Datos principales
  operacion: z.string().default('generar_comprobante'),
  tipo_de_comprobante: z.number().int(),
  serie: z.string(),
  numero: z.number().int(),
  sunat_transaction: z.number().int(),

  // Cliente
  cliente_tipo_de_documento: z.number().int(),
  cliente_numero_de_documento: z.string(),
  cliente_denominacion: z.string(),
  cliente_direccion: z.string().optional(),
  cliente_email: z.string().optional(),
  cliente_email_1: z.string().optional(),
  cliente_email_2: z.string().optional(),

  // Fechas (formato DD-MM-YYYY)
  fecha_de_emision: z.string(),
  fecha_de_vencimiento: z.string().optional(),
  fecha_de_servicio: z.string().optional(),

  // Moneda
  moneda: z.number().int(),
  tipo_de_cambio: z.number().optional(),
  porcentaje_de_igv: z.number(),

  // Totales
  descuento_global: z.number().optional(),
  total_descuento: z.number().optional(),
  total_anticipo: z.number().optional(),
  total_gravada: z.number().optional(),
  total_inafecta: z.number().optional(),
  total_exonerada: z.number().optional(),
  total_igv: z.number().optional(),
  total_gratuita: z.number().optional(),
  total_otros_cargos: z.number().optional(),
  total_isc: z.number().optional(),
  total: z.number(),

  // Detracción
  detraccion: z.boolean().optional(),
  detraccion_tipo: z.number().int().optional(),
  detraccion_porcentaje: z.number().optional(),
  detraccion_total: z.number().optional(),
  medio_pago_detraccion: z.number().int().optional(), // Para detracciones (número)

  // Ubicaciones (para servicios de transporte)
  ubigeo_de_origen: z.string().optional(),
  direccion_de_origen: z.string().optional(),
  ubigeo_de_destino: z.string().optional(),
  direccion_de_destino: z.string().optional(),
  detalle_viaje: z.string().optional(),

  // Percepción
  percepcion_tipo: z.number().int().optional(),
  percepcion_base_imponible: z.number().optional(),
  total_percepcion: z.number().optional(),
  total_incluido_percepcion: z.number().optional(),

  // Retención
  retencion_tipo: z.number().int().optional(),
  retencion_base_imponible: z.number().optional(),
  total_retencion: z.number().optional(),

  // Información adicional
  observaciones: z.string().optional(),
  documento_que_se_modifica_tipo: z.number().int().optional(), // Para notas de crédito/débito
  documento_que_se_modifica_serie: z.string().optional(),
  documento_que_se_modifica_numero: z.number().int().optional(),
  tipo_de_nota_de_credito: z.string().optional(),
  tipo_de_nota_de_debito: z.string().optional(),

  // Orden de compra
  orden_compra_servicio: z.string().optional(),
  placa_vehiculo: z.string().optional(),

  // Configuración de envío
  enviar_automaticamente_a_la_sunat: z.boolean().optional(),
  enviar_automaticamente_al_cliente: z.boolean().optional(),
  codigo_unico: z.string().optional(),
  formato_de_pdf: z.string().optional(),

  // Forma de pago (según documentación NubeFact)
  condiciones_de_pago: z.string().optional(),
  medio_de_pago: z.string().optional(), // String para forma de pago general (solo CONTADO)

  // Items
  items: z.array(NubefactFacturaItemSchema),

  // Guías relacionadas
  guias: z.array(NubefactFacturaGuiaSchema).optional(),

  // Venta a crédito (solo CREDITO)
  venta_al_credito: z.array(NubefactFacturaVentaCreditoSchema).optional(),
});

// Schema para consultar comprobante
export const NubefactConsultarSchema = z.object({
  operacion: z.string().default('consultar_comprobante'),
  tipo_de_comprobante: z.number().int(),
  serie: z.string(),
  numero: z.number().int(),
});

// Tipos inferidos
export type NubefactFacturaItemDto = z.infer<typeof NubefactFacturaItemSchema>;
export type NubefactFacturaGuiaDto = z.infer<typeof NubefactFacturaGuiaSchema>;
export type NubefactFacturaVentaCreditoDto = z.infer<
  typeof NubefactFacturaVentaCreditoSchema
>;
export type NubefactFacturaDto = z.infer<typeof NubefactFacturaSchema>;
export type NubefactConsultarDto = z.infer<typeof NubefactConsultarSchema>;
