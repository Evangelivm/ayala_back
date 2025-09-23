import { z } from 'zod';

export const CreateSubpartidaSchema = z.object({
  id_subfrente: z.number().min(1, 'El ID del subfrente es requerido'),
  codigo: z.string().min(1, 'El código es requerido').max(50, 'El código no puede exceder 50 caracteres'),
  descripcion: z.string().min(1, 'La descripción es requerida').max(255, 'La descripción no puede exceder 255 caracteres'),
  unidad_medida: z.string().max(20, 'La unidad de medida no puede exceder 20 caracteres').optional(),
  cantidad: z.number().min(0, 'La cantidad debe ser mayor o igual a 0'),
  precio_unitario: z.number().min(0, 'El precio unitario debe ser mayor o igual a 0').optional(),
  total: z.number().min(0, 'El total debe ser mayor o igual a 0').optional(),
  orden: z.number().min(1).optional(),
  activo: z.boolean().default(true),
});

export const UpdateSubpartidaSchema = CreateSubpartidaSchema.partial().omit({ id_subfrente: true });

export const SubpartidaResponseSchema = z.object({
  id_subpartida: z.number(),
  id_subfrente: z.number(),
  codigo: z.string(),
  descripcion: z.string(),
  unidad_medida: z.string().nullable(),
  cantidad: z.number(),
  precio_unitario: z.number().nullable(),
  total: z.number().nullable(),
  orden: z.number(),
  activo: z.boolean(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export type CreateSubpartidaDto = z.infer<typeof CreateSubpartidaSchema>;
export type UpdateSubpartidaDto = z.infer<typeof UpdateSubpartidaSchema>;
export type SubpartidaResponseDto = z.infer<typeof SubpartidaResponseSchema>;