import { z } from 'zod';

export const CreateSubsectorSchema = z.object({
  id_sub_etapa: z.number().min(1, 'El ID de la sub-etapa es requerido'),
  nombre: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  descripcion: z.string().optional(),
  ubicacion: z.string().max(255, 'La ubicación no puede exceder 255 caracteres').optional(),
  orden: z.number().min(1).optional(),
  activo: z.boolean().default(true),
});

export const UpdateSubsectorSchema = CreateSubsectorSchema.partial().omit({ id_sub_etapa: true });

export const SubsectorResponseSchema = z.object({
  id_subsector: z.number(),
  id_sub_etapa: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  ubicacion: z.string().nullable(),
  orden: z.number(),
  activo: z.boolean(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export type CreateSubsectorDto = z.infer<typeof CreateSubsectorSchema>;
export type UpdateSubsectorDto = z.infer<typeof UpdateSubsectorSchema>;
export type SubsectorResponseDto = z.infer<typeof SubsectorResponseSchema>;