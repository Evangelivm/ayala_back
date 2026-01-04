import { z } from 'zod';

// Schema para el item de una factura
export const CreateFacturaItemSchema = z.object({
  codigo_item: z.string().optional().nullable(),
  codigo_producto_sunat: z.string().optional().nullable(),
  descripcion_item: z.string().min(1, 'La descripción del item es requerida'),
  unidad_medida: z.string().min(1, 'La unidad de medida es requerida'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  valor_unitario: z.number().nonnegative('El valor unitario no puede ser negativo'),
  precio_unitario: z.number().nonnegative('El precio unitario no puede ser negativo'),
  descuento: z.number().nonnegative().optional().nullable(),
  subtotal: z.number().nonnegative('El subtotal no puede ser negativo'),
  tipo_de_igv: z.number().int().positive('El tipo de IGV es requerido'),
  igv: z.number().nonnegative('El IGV no puede ser negativo'),
  tipo_de_isc: z.number().int().positive().optional().nullable(),
  isc: z.number().nonnegative().optional().nullable(),
  total: z.number().nonnegative('El total no puede ser negativo'),
  anticipo_regularizacion: z.boolean().default(false),
  anticipo_documento_serie: z.string().optional().nullable(),
  anticipo_documento_numero: z.number().int().positive().optional().nullable(),
});

// Schema para guía relacionada (opcional)
export const CreateFacturaGuiaSchema = z.object({
  guia_tipo: z.number().int().positive('El tipo de guía es requerido'),
  guia_serie_numero: z.string().min(1, 'La serie y número de guía son requeridos'),
});

// Schema para venta a crédito (opcional)
export const CreateFacturaVentaCreditoSchema = z.object({
  cuota: z.number().int().positive('El número de cuota es requerido'),
  fecha_de_pago: z.string().min(1, 'La fecha de pago es requerida'), // NubeFact usa "fecha_de_pago"
  importe: z.number().positive('El importe debe ser mayor a 0'),
});

// Schema principal para crear una factura
export const CreateFacturaSchema = z
  .object({
    // Datos principales
    tipo_de_comprobante: z.number().int().positive('El tipo de comprobante es requerido'),
    serie: z.string().length(4, 'La serie debe tener 4 caracteres'),
    numero: z.number().int().positive('El número es requerido'),
    sunat_transaction: z.number().int().positive().default(1),
    id_proveedor: z.number().int().positive('El ID del proveedor es requerido'),

    // Cliente
    cliente_tipo_documento: z.number().int().positive().default(6),
    cliente_numero_documento: z.string().min(1, 'El número de documento es requerido'),
    cliente_denominacion: z.string().min(1, 'La denominación del cliente es requerida'),
    cliente_direccion: z.string().optional().nullable(),
    cliente_email: z.string().email('Email inválido').optional().nullable(),
    cliente_email_1: z.string().email('Email inválido').optional().nullable(),
    cliente_email_2: z.string().email('Email inválido').optional().nullable(),

    // Fechas
    fecha_emision: z.string().min(1, 'La fecha de emisión es requerida'),
    fecha_vencimiento: z.string().optional().nullable(),
    fecha_servicio: z.string().optional().nullable(),

    // Tipo de venta
    tipo_venta: z.enum(['CONTADO', 'CREDITO']).default('CONTADO'),
    plazo_credito: z.number().int().nonnegative().optional().nullable(),

    // Forma de pago (según documentación NubeFact)
    condiciones_de_pago: z.string().optional().nullable(),
    medio_de_pago: z.string().optional().nullable(), // Solo para CONTADO

    // Moneda y totales
    moneda: z.number().int().positive().default(1), // 1 = PEN, 2 = USD
    tipo_cambio: z.number().nonnegative().optional().nullable(),
    porcentaje_igv: z.number().nonnegative().default(18.0),
    descuento_global: z.number().nonnegative().optional().nullable(),
    total_descuento: z.number().nonnegative().optional().nullable(),
    total_anticipo: z.number().nonnegative().optional().nullable(),
    total_gravada: z.number().nonnegative().optional().nullable(),
    total_inafecta: z.number().nonnegative().optional().nullable(),
    total_exonerada: z.number().nonnegative().optional().nullable(),
    total_igv: z.number().nonnegative().optional().nullable(),
    total_gratuita: z.number().nonnegative().optional().nullable(),
    total_otros_cargos: z.number().nonnegative().optional().nullable(),
    total_isc: z.number().nonnegative().optional().nullable(),
    total: z.number().positive('El total debe ser mayor a 0'),

    // Detracción (opcional)
    aplicar_detraccion: z.boolean().default(false),
    detraccion_tipo: z.number().int().positive().optional().nullable(),
    detraccion_porcentaje: z.number().nonnegative().optional().nullable(),
    detraccion_total: z.number().nonnegative().optional().nullable(),
    medio_pago_detraccion: z.number().int().positive().optional().nullable(),

    // Ubicaciones (opcional, para servicios de transporte)
    ubigeo_origen: z.string().optional().nullable(),
    direccion_origen: z.string().optional().nullable(),
    ubigeo_destino: z.string().optional().nullable(),
    direccion_destino: z.string().optional().nullable(),
    detalle_viaje: z.string().optional().nullable(),

    // Percepción (opcional)
    percepcion_tipo: z.number().int().positive().optional().nullable(),
    percepcion_base_imponible: z.number().nonnegative().optional().nullable(),
    total_percepcion: z.number().nonnegative().optional().nullable(),
    total_incluido_percepcion: z.number().nonnegative().optional().nullable(),

    // Retención (opcional)
    retencion_tipo: z.number().int().positive().optional().nullable(),
    retencion_base_imponible: z.number().nonnegative().optional().nullable(),
    total_retencion: z.number().nonnegative().optional().nullable(),

    // Opcionales adicionales
    fondo_garantia: z.boolean().default(false),
    fondo_garantia_valor: z.string().optional().nullable(),
    orden_compra: z.boolean().default(false),
    orden_compra_valor: z.string().optional().nullable(),
    placa_vehiculo: z.string().max(8).optional().nullable(),
    orden_compra_servicio: z.string().max(20).optional().nullable(),

    // Centros de costo (opcional)
    centro_costo_nivel1_codigo: z.string().optional().nullable(),
    centro_costo_nivel2_codigo: z.string().optional().nullable(),
    centro_costo_nivel3_codigo: z.string().optional().nullable(),
    unidad: z.string().optional().nullable(),
    unidad_id: z.number().int().positive().optional().nullable(),

    // Observaciones
    observaciones: z.string().optional().nullable(),

    // Configuración de envío
    enviar_automaticamente_sunat: z.boolean().default(true),
    enviar_automaticamente_cliente: z.boolean().default(false),
    formato_pdf: z.string().default('A4'),

    // Items (al menos 1 requerido)
    items: z
      .array(CreateFacturaItemSchema)
      .min(1, 'Debe incluir al menos un item'),

    // Guías relacionadas (opcional)
    guias: z.array(CreateFacturaGuiaSchema).optional(),

    // Cuotas de crédito (opcional) - NubeFact usa "venta_al_credito"
    cuotas_credito: z.array(CreateFacturaVentaCreditoSchema).optional(),
    venta_al_credito: z.array(CreateFacturaVentaCreditoSchema).optional(),
  })
  .strip(); // Ignorar campos adicionales

// Tipos inferidos de los schemas
export type CreateFacturaItemDto = z.infer<typeof CreateFacturaItemSchema>;
export type CreateFacturaGuiaDto = z.infer<typeof CreateFacturaGuiaSchema>;
export type CreateFacturaVentaCreditoDto = z.infer<
  typeof CreateFacturaVentaCreditoSchema
>;
export type CreateFacturaDto = z.infer<typeof CreateFacturaSchema>;
