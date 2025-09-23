import { z } from 'zod';

export const CreateSubproyectoSchema = z.object({
  id_proyecto: z.number().min(1, 'El ID del proyecto es requerido'),
  nombre: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  descripcion: z.string().optional(),
  orden: z.number().min(1).optional(),
  activo: z.boolean().default(true),
});

export const UpdateSubproyectoSchema = CreateSubproyectoSchema.partial().omit({ id_proyecto: true });

export const SubproyectoResponseSchema = z.object({
  id_subproyecto: z.number(),
  id_proyecto: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  orden: z.number(),
  activo: z.boolean(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export type CreateSubproyectoDto = z.infer<typeof CreateSubproyectoSchema>;
export type UpdateSubproyectoDto = z.infer<typeof UpdateSubproyectoSchema>;
export type SubproyectoResponseDto = z.infer<typeof SubproyectoResponseSchema>;