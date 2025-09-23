import { z } from 'zod';

export const CreateSubfrenteSchema = z.object({
  id_subsector: z.number().min(1, 'El ID del subsector es requerido'),
  nombre: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  descripcion: z.string().optional(),
  responsable: z.string().max(100, 'El responsable no puede exceder 100 caracteres').optional(),
  orden: z.number().min(1).optional(),
  activo: z.boolean().default(true),
});

export const UpdateSubfrenteSchema = CreateSubfrenteSchema.partial().omit({ id_subsector: true });

export const SubfrenteResponseSchema = z.object({
  id_subfrente: z.number(),
  id_subsector: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  responsable: z.string().nullable(),
  orden: z.number(),
  activo: z.boolean(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export type CreateSubfrenteDto = z.infer<typeof CreateSubfrenteSchema>;
export type UpdateSubfrenteDto = z.infer<typeof UpdateSubfrenteSchema>;
export type SubfrenteResponseDto = z.infer<typeof SubfrenteResponseSchema>;