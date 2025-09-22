import { z } from 'zod';

// Schema para creación de sector
export const CreateSectorSchema = z.object({
  id_etapa: z.number().min(1, 'El ID de la etapa es requerido'),
  nombre: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  descripcion: z.string().optional(),
  ubicacion: z.string().max(255, 'La ubicación no puede exceder 255 caracteres').optional(),
  orden: z.number().min(1).optional(), // Se calculará automáticamente si no se proporciona
  activo: z.boolean().default(true),
});

// Schema para actualización de sector
export const UpdateSectorSchema = CreateSectorSchema.partial().omit({ id_etapa: true });

// Schema para respuesta de sector
export const SectorResponseSchema = z.object({
  id_sector: z.number(),
  id_etapa: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  ubicacion: z.string().nullable(),
  orden: z.number(),
  activo: z.boolean(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

// Tipos TypeScript derivados
export type CreateSectorDto = z.infer<typeof CreateSectorSchema>;
export type UpdateSectorDto = z.infer<typeof UpdateSectorSchema>;
export type SectorResponseDto = z.infer<typeof SectorResponseSchema>;