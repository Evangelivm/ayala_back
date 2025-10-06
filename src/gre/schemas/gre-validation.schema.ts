import { z } from 'zod';

// Validaciones para tipos de documento SUNAT
const TipoDocumentoEnum = z.enum(['1', '4', '6', '7', 'A']);

// Validación de DNI (exactamente 8 dígitos)
const DniSchema = z.string().regex(/^\d{8}$/, 'DNI debe tener exactamente 8 dígitos');

// Validación de RUC (exactamente 11 dígitos, empezar con 10 o 20)
const RucSchema = z.string().regex(/^(10|20)\d{9}$/, 'RUC debe tener 11 dígitos y empezar con 10 o 20');

// Validación de documento según tipo
const DocumentoSchema = z.object({
  tipo: TipoDocumentoEnum,
  numero: z.string()
}).refine((data) => {
  if (data.tipo === '1') {
    return DniSchema.safeParse(data.numero).success;
  }
  if (data.tipo === '6') {
    return RucSchema.safeParse(data.numero).success;
  }
  if (data.tipo === '4') {
    return data.numero.length <= 12; // Carnet de extranjería
  }
  return true;
}, {
  message: 'Número de documento no válido para el tipo especificado'
});

// Validación de UBIGEO (6 dígitos)
const UbigeoSchema = z.string().regex(/^\d{6}$/, 'UBIGEO debe tener exactamente 6 dígitos');

// Validación de placa de vehículo (formato ABC-123 o ABC123)
const PlacaSchema = z.string().regex(/^[A-Z]{3}-?\d{3}$/, 'Placa debe tener formato ABC-123 o ABC123').max(8);

// Validación de licencia (formato Q + 8 dígitos)
const LicenciaSchema = z.string().regex(/^Q\d{8}$/, 'Licencia debe tener formato Q seguido de 8 dígitos');

// Validación de fecha (formato DD-MM-YYYY, no futura)
const FechaSchema = z.string().regex(/^\d{2}-\d{2}-\d{4}$/, 'Fecha debe tener formato DD-MM-YYYY')
  .refine((fecha) => {
    const [dia, mes, año] = fecha.split('-').map(Number);
    const fechaObj = new Date(año, mes - 1, dia);
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999); // Permitir fecha de hoy
    return fechaObj <= hoy;
  }, {
    message: 'La fecha no puede ser futura'
  });

// Schema para items de GRE
const ItemGreSchema = z.object({
  unidad_de_medida: z.string().min(1, 'Unidad de medida es obligatoria'),
  codigo: z.string().max(30, 'Código máximo 30 caracteres').min(1, 'Código es obligatorio'),
  descripcion: z.string().max(250, 'Descripción máximo 250 caracteres').min(1, 'Descripción es obligatoria'),
  cantidad: z.number().positive('Cantidad debe ser mayor a 0'),
  valor_unitario: z.number().min(0, 'Valor unitario debe ser >= 0'),
  precio_unitario: z.number().min(0, 'Precio unitario debe ser >= 0'),
  descuento: z.string().optional(),
  subtotal: z.number().min(0, 'Subtotal debe ser >= 0'),
  tipo_de_igv: z.number().int().min(1).max(8, 'Tipo de IGV debe estar entre 1 y 8'),
  igv: z.number().min(0, 'IGV debe ser >= 0'),
  total: z.number().min(0, 'Total debe ser >= 0'),
  anticipo_regularizacion: z.boolean().default(false),
  anticipo_documento_serie: z.string().optional(),
  anticipo_documento_numero: z.string().optional()
});

// Schema principal para validación de GRE
export const GreValidationSchema = z.object({
  operacion: z.literal('generar_guia', {
    errorMap: () => ({ message: 'Operación debe ser exactamente "generar_guia"' })
  }),
  tipo_de_comprobante: z.literal(9, {
    errorMap: () => ({ message: 'Tipo de comprobante debe ser 9 (GRE)' })
  }),
  serie: z.string().max(4, 'Serie máximo 4 caracteres').regex(/^T\d{3}$/, 'Serie debe tener formato T001-T999'),
  numero: z.number().int().positive('Número debe ser positivo'),
  sunat_transaction: z.union([z.literal(1), z.literal(2)], {
    errorMap: () => ({ message: 'sunat_transaction debe ser 1 o 2' })
  }),

  // Datos del cliente
  cliente_tipo_de_documento: TipoDocumentoEnum,
  cliente_numero_de_documento: z.string(),
  cliente_denominacion: z.string().max(100, 'Denominación máximo 100 caracteres').min(1, 'Denominación es obligatoria'),
  cliente_direccion: z.string().max(100, 'Dirección máximo 100 caracteres').min(1, 'Dirección es obligatoria'),

  // Datos de emisión
  fecha_de_emision: FechaSchema,
  moneda: z.enum(['PEN', 'USD', 'EUR'], { errorMap: () => ({ message: 'Moneda debe ser PEN, USD o EUR' }) }),
  tipo_de_cambio: z.string().optional(),
  porcentaje_de_igv: z.number().default(18.00),

  // Totales
  descuento_global: z.string().optional(),
  total_descuento: z.string().optional(),
  total_anticipo: z.string().optional(),
  total_gravada: z.number().min(0, 'Total gravada debe ser >= 0'),
  total_inafecta: z.number().min(0, 'Total inafecta debe ser >= 0'),
  total_exonerada: z.number().min(0, 'Total exonerada debe ser >= 0'),
  total_igv: z.number().min(0, 'Total IGV debe ser >= 0'),
  total_gratuita: z.number().min(0, 'Total gratuita debe ser >= 0'),
  total_otros_cargos: z.number().min(0, 'Total otros cargos debe ser >= 0'),
  total: z.number().min(0, 'Total debe ser >= 0'),

  // Configuración
  enviar_automaticamente_a_la_sunat: z.boolean().default(true),
  enviar_automaticamente_al_cliente: z.boolean().default(false),
  codigo_unico: z.string().optional(),
  condiciones_de_pago: z.string().optional(),
  medio_de_pago: z.string().optional(),
  placa_vehiculo: PlacaSchema,
  orden_compra_servicio: z.string().optional(),
  tabla_personalizada_codigo: z.string().optional(),
  formato_de_pdf: z.string().optional(),

  // Items (mínimo 1)
  items: z.array(ItemGreSchema).min(1, 'Debe haber al menos 1 item'),
  descuentos: z.array(z.any()).default([]),
  anticipo: z.array(z.any()).default([]),
  informacion_adicional: z.string().optional(),
  tienda: z.string().optional(),

  // Parámetros de transporte (OBLIGATORIOS para GRE)
  parametros_adicionales: z.object({
    UBIGEO_PARTIDA: UbigeoSchema,
    DIRECCION_PARTIDA: z.string().max(100, 'Dirección de partida máximo 100 caracteres').min(1, 'Dirección de partida es obligatoria'),
    UBIGEO_LLEGADA: UbigeoSchema,
    DIRECCION_LLEGADA: z.string().max(100, 'Dirección de llegada máximo 100 caracteres').min(1, 'Dirección de llegada es obligatoria'),
    NUMERO_DOCUMENTO_CONDUCTOR: DniSchema,
    TIPO_DOCUMENTO_CONDUCTOR: z.literal('1', { errorMap: () => ({ message: 'Tipo documento conductor debe ser "1" (DNI)' }) }),
    NOMBRES_CONDUCTOR: z.string().max(50, 'Nombres conductor máximo 50 caracteres').min(1, 'Nombres conductor es obligatorio'),
    APELLIDOS_CONDUCTOR: z.string().max(50, 'Apellidos conductor máximo 50 caracteres').min(1, 'Apellidos conductor es obligatorio'),
    NUMERO_LICENCIA: LicenciaSchema,
    NUMERO_DOCUMENTO_TRANSPORTE: RucSchema,
    TIPO_DOCUMENTO_TRANSPORTE: z.literal('6', { errorMap: () => ({ message: 'Tipo documento transporte debe ser "6" (RUC)' }) }),
    RAZON_SOCIAL_TRANSPORTE: z.string().max(100, 'Razón social transporte máximo 100 caracteres').min(1, 'Razón social transporte es obligatoria'),
    NUMERO_MTCVC: z.string().max(9, 'Número MTCVC máximo 9 dígitos').regex(/^\d{1,9}$/, 'NUMERO_MTCVC debe ser numérico')
  })
}).refine((data) => {
  // Validación adicional: cliente documento
  return DocumentoSchema.safeParse({
    tipo: data.cliente_tipo_de_documento,
    numero: data.cliente_numero_de_documento
  }).success;
}, {
  message: 'Documento del cliente no válido para el tipo especificado',
  path: ['cliente_numero_de_documento']
}).refine((data) => {
  // Validación adicional: suma de items vs total
  const sumaItems = data.items.reduce((sum, item) => sum + item.total, 0);
  const diferencia = Math.abs(sumaItems - data.total);
  return diferencia < 0.01; // Permitir diferencias menores por redondeo
}, {
  message: 'La suma de los items no coincide con el total',
  path: ['total']
});

// Schema para mensajes de Kafka
export const KafkaGreRequestSchema = z.object({
  id: z.string().uuid('ID debe ser un UUID válido'),
  timestamp: z.string().datetime('Timestamp debe ser una fecha ISO válida'),
  data: GreValidationSchema
});

export const KafkaGreResponseSchema = z.object({
  id: z.string().uuid('ID debe ser un UUID válido'),
  status: z.enum(['success', 'error']),
  nubefact_response: z.object({
    pdf_url: z.string().url().optional(),
    xml_url: z.string().url().optional(),
    cdr_url: z.string().url().optional()
  }).optional(),
  error: z.string().nullable()
});

// Types exportados
export type GreValidationData = z.infer<typeof GreValidationSchema>;
export type KafkaGreRequest = z.infer<typeof KafkaGreRequestSchema>;
export type KafkaGreResponse = z.infer<typeof KafkaGreResponseSchema>;