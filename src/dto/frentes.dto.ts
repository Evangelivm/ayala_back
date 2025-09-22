import { z } from 'zod';

// Schema para creación de frente
export const CreateFrenteSchema = z.object({
  id_sector: z.number().min(1, 'El ID del sector es requerido'),
  nombre: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  descripcion: z.string().optional(),
  responsable: z.string().max(100, 'El responsable no puede exceder 100 caracteres').optional(),
  orden: z.number().min(1).optional(), // Se calculará automáticamente si no se proporciona
  activo: z.boolean().default(true),
});

// Schema para actualización de frente
export const UpdateFrenteSchema = CreateFrenteSchema.partial().omit({ id_sector: true });

// Schema para respuesta de frente
export const FrenteResponseSchema = z.object({
  id_frente: z.number(),
  id_sector: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  responsable: z.string().nullable(),
  orden: z.number(),
  activo: z.boolean(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

// Tipos TypeScript derivados
export type CreateFrenteDto = z.infer<typeof CreateFrenteSchema>;
export type UpdateFrenteDto = z.infer<typeof UpdateFrenteSchema>;
export type FrenteResponseDto = z.infer<typeof FrenteResponseSchema>;