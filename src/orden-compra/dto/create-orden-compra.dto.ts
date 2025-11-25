import { z } from 'zod';

// Enum para el estado de la orden de compra
export enum EstadoOrdenCompra {
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  PARCIALMENTE_RECEPCIONADA = 'PARCIALMENTE_RECEPCIONADA',
  COMPLETADA = 'COMPLETADA',
  CANCELADA = 'CANCELADA',
  FIRMADA = 'FIRMADA',
}

// Schema para el detalle de orden de compra
export const CreateDetalleOrdenCompraSchema = z.object({
  codigo_item: z.string().min(1, 'El código del item es requerido'),
  descripcion_item: z.string().min(1, 'La descripción del item es requerida'),
  cantidad_solicitada: z.number().positive('La cantidad debe ser mayor a 0'),
  precio_unitario: z.number().nonnegative('El precio unitario no puede ser negativo'),
  subtotal: z.number().nonnegative('El subtotal no puede ser negativo'),
});

// Schema para la orden de compra
export const CreateOrdenCompraSchema = z.object({
  id_proveedor: z.number().int().positive('El ID del proveedor es requerido'),
  numero_orden: z.string().min(1, 'El número de orden es requerido'),
  fecha_orden: z.string().datetime('Fecha de orden inválida'),
  moneda: z.string().min(1, 'La moneda es requerida'),
  fecha_registro: z.string().datetime('Fecha de registro inválida'),
  estado: z.nativeEnum(EstadoOrdenCompra, {
    errorMap: () => ({ message: 'Estado inválido' }),
  }),
  centro_costo_nivel1: z.string().optional(),
  centro_costo_nivel2: z.string().optional(),
  centro_costo_nivel3: z.string().optional(),
  unidad_id: z.number().int().positive().optional().nullable(),
  retencion: z.string().optional(),
  almacen_central: z.string().optional(),
  has_anticipo: z.number().int().min(0).max(1).optional(),
  tiene_anticipo: z.string().optional(),
  items: z
    .array(CreateDetalleOrdenCompraSchema)
    .min(1, 'Debe incluir al menos un item'),
  subtotal: z.number().nonnegative('El subtotal no puede ser negativo'),
  igv: z.number().nonnegative('El IGV no puede ser negativo'),
  total: z.number().positive('El total debe ser mayor a 0'),
  observaciones: z.string().optional(),
  registrado_por: z.number().int().positive().optional(),
});

// Tipos inferidos de los schemas
export type CreateDetalleOrdenCompraDto = z.infer<
  typeof CreateDetalleOrdenCompraSchema
>;
export type CreateOrdenCompraDto = z.infer<typeof CreateOrdenCompraSchema>;
