import { z } from 'zod';

// Schema para creación de etapa
export const CreateEtapaSchema = z.object({
  id_proyecto: z.number().min(1, 'El ID del proyecto es requerido'),
  nombre: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  descripcion: z.string().optional(),
  orden: z.number().min(1).optional(),
  activo: z.boolean().default(true),
});

// Schema para actualización de etapa
export const UpdateEtapaSchema = CreateEtapaSchema.partial().omit({ id_proyecto: true });

// Schema para respuesta de etapa
export const EtapaResponseSchema = z.object({
  id_etapa: z.number(),
  id_proyecto: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  orden: z.number(),
  activo: z.boolean(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

// Tipos TypeScript derivados
export type CreateEtapaDto = z.infer<typeof CreateEtapaSchema>;
export type UpdateEtapaDto = z.infer<typeof UpdateEtapaSchema>;
export type EtapaResponseDto = z.infer<typeof EtapaResponseSchema>;