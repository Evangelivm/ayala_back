import { z } from 'zod';

// Schema para creación de partida (coincide con el modelo Prisma)
export const CreatePartidaSchema = z.object({
  id_frente: z.number().min(1, 'El ID del frente es requerido'),
  codigo: z.string().min(1, 'El código es requerido').max(50, 'El código no puede exceder 50 caracteres'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  unidad_medida: z.string().max(20, 'La unidad de medida no puede exceder 20 caracteres').optional(),
  cantidad: z.number().min(0, 'La cantidad debe ser positiva').transform(val => Number(val)), // Convierte a Decimal
  precio_unitario: z.number().min(0, 'El precio unitario debe ser positivo').optional().transform(val => val ? Number(val) : undefined),
  total: z.number().min(0, 'El total debe ser positivo').optional().transform(val => val ? Number(val) : undefined),
  orden: z.number().min(1).optional(), // Se calculará automáticamente si no se proporciona
  activo: z.boolean().default(true),
});

// Schema para actualización de partida
export const UpdatePartidaSchema = CreatePartidaSchema.partial().omit({ id_frente: true });

// Schema para respuesta de partida (coincide con el modelo Prisma)
export const PartidaResponseSchema = z.object({
  id_partida: z.number(),
  id_frente: z.number(),
  codigo: z.string(),
  descripcion: z.string(),
  unidad_medida: z.string().nullable(),
  cantidad: z.number(), // Decimal en Prisma se mapea a number
  precio_unitario: z.number().nullable(),
  total: z.number().nullable(),
  created_at: z.date().nullable(),
  updated_at: z.date().nullable(),
  activo: z.boolean().nullable(),
  orden: z.number().nullable(),
});

// Tipos TypeScript derivados
export type CreatePartidaDto = z.infer<typeof CreatePartidaSchema>;
export type UpdatePartidaDto = z.infer<typeof UpdatePartidaSchema>;
export type PartidaResponseDto = z.infer<typeof PartidaResponseSchema>;