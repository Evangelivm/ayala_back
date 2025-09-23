import { z } from 'zod';

export const CreateSubEtapaSchema = z.object({
  id_subproyecto: z.number().min(1, 'El ID del subproyecto es requerido'),
  nombre: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  descripcion: z.string().optional(),
  orden: z.number().min(1).optional(),
  activo: z.boolean().default(true),
});

export const UpdateSubEtapaSchema = CreateSubEtapaSchema.partial().omit({ id_subproyecto: true });

export const SubEtapaResponseSchema = z.object({
  id_sub_etapa: z.number(),
  id_subproyecto: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  orden: z.number(),
  activo: z.boolean(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export type CreateSubEtapaDto = z.infer<typeof CreateSubEtapaSchema>;
export type UpdateSubEtapaDto = z.infer<typeof UpdateSubEtapaSchema>;
export type SubEtapaResponseDto = z.infer<typeof SubEtapaResponseSchema>;