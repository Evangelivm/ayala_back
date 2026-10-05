import { z } from 'zod';

// Enum para el estado de la orden de servicio
export enum EstadoOrdenServicio {
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  PARCIALMENTE_RECEPCIONADA = 'PARCIALMENTE_RECEPCIONADA',
  COMPLETADA = 'COMPLETADA',
  CANCELADA = 'CANCELADA',
  FIRMADA = 'FIRMADA',
}

// Schema para el detalle de orden de servicio
export const CreateDetalleOrdenServicioSchema = z
  .object({
    codigo_item: z.string().min(1, 'El código del item es requerido'),
    descripcion_item: z.string().min(1, 'La descripción del item es requerida'),
    cantidad_solicitada: z.number().positive('La cantidad debe ser mayor a 0'),
    precio_unitario: z
      .number()
      .nonnegative('El precio unitario no puede ser negativo'),
    subtotal: z.number().nonnegative('El subtotal no puede ser negativo'),
    centro_costo: z.string().optional(),
    prorrateo: z.number().min(0).max(100).optional(),
    unidad_id: z.union([z.number().int().positive(), z.null()]).optional(),
  })
  .strip(); // Ignorar campos adicionales que no están en el schema

// Schema para la orden de servicio
export const CreateOrdenServicioSchema = z
  .object({
    id_proveedor: z.number().int().positive('El ID del proveedor es requerido'),
    numero_orden: z.string().min(1, 'El número de orden es requerido'),
    fecha_orden: z.string().date('Fecha de orden inválida'),
    moneda: z.string().min(1, 'La moneda es requerida'),
    fecha_registro: z.string().datetime('Fecha de registro inválida'),
    estado: z.nativeEnum(EstadoOrdenServicio, {
      errorMap: () => ({ message: 'Estado inválido' }),
    }),
    centro_costo_nivel1: z.string().optional(),
    centro_costo_nivel2: z.string().optional(),
    centro_costo_nivel3: z.string().optional(),
    unidad_id: z.union([z.number().int().positive(), z.null()]).optional(),
    detraccion: z.string().optional(),
    tipo_detraccion: z.string().optional(),
    porcentaje_valor_detraccion: z.string().optional(),
    valor_detraccion: z
      .number()
      .nonnegative('El valor de detracción no puede ser negativo')
      .optional(),
    retencion: z.string().optional(),
    porcentaje_valor_retencion: z.string().optional(),
    valor_retencion: z
      .number()
      .nonnegative('El valor de retención no puede ser negativo')
      .optional(),
    almacen_central: z.string().optional(),
    has_anticipo: z.number().int().min(0).max(1).optional(),
    tiene_anticipo: z.string().optional(),
    tipo_comprobante: z.enum(['FACTURA', 'RH']).optional(),
    nro_rh: z.string().optional(),
    items: z
      .array(CreateDetalleOrdenServicioSchema)
      .min(1, 'Debe incluir al menos un item'),
    subtotal: z.number().nonnegative('El subtotal no puede ser negativo'),
    igv: z.number().nonnegative('El IGV no puede ser negativo'),
    total: z.number().positive('El total debe ser mayor a 0'),
    observaciones: z.string().optional(),
    registrado_por: z.number().int().positive().optional(),
    editado_por: z.number().int().positive().optional(),
    // Clave de reserva del número (generada por el navegador al abrir el dialog)
    reserva_owner: z.string().max(64).optional(),
  })
  .strip(); // Ignorar campos adicionales que no están en el schema

// Guardado en lote (multifactura): 2 o más órdenes que forman un grupo
export const CreateBatchOrdenServicioSchema = z
  .object({
    ordenes: z
      .array(CreateOrdenServicioSchema)
      .min(2, 'Una multifactura requiere al menos 2 órdenes')
      .max(20, 'Máximo 20 órdenes por multifactura'),
    // Clave de reserva de los números (misma para todas las tabs del dialog)
    reserva_owner: z.string().max(64).optional(),
  })
  .strip();

// Convertir órdenes existentes en multifactura (o sumarlas a un grupo existente)
export const AgruparOrdenesSchema = z
  .object({
    ids: z.array(z.number().int().positive()).min(1).max(20),
    // Sin grupo_id se crea un grupo nuevo (requiere 2 o más órdenes)
    grupo_id: z.string().min(8).max(36).optional(),
  })
  .strip();

// Crear una orden nueva dentro del grupo de una orden existente
export const AgregarOrdenNuevaSchema = z
  .object({
    orden: CreateOrdenServicioSchema,
    reserva_owner: z.string().max(64).optional(),
  })
  .strip();

// Tipos inferidos de los schemas
export type AgruparOrdenesDto = z.infer<typeof AgruparOrdenesSchema>;
export type AgregarOrdenNuevaDto = z.infer<typeof AgregarOrdenNuevaSchema>;
export type CreateBatchOrdenServicioDto = z.infer<
  typeof CreateBatchOrdenServicioSchema
>;
export type CreateDetalleOrdenServicioDto = z.infer<
  typeof CreateDetalleOrdenServicioSchema
>;
export type CreateOrdenServicioDto = z.infer<typeof CreateOrdenServicioSchema>;
