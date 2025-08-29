import { z } from 'zod';

export const MaquinariaSchema = z.object({
  id: z.number().optional(),
  nombre: z.string().min(1, 'El nombre de la maquinaria es requerido'),
  tipo: z.string().min(1, 'El tipo de maquinaria es requerido'),
  modelo: z.string().min(1, 'El modelo es requerido'),
  activo: z.boolean().default(true),
});

export const CreateMaquinariaSchema = MaquinariaSchema.omit({ id: true });

export const UpdateMaquinariaSchema = MaquinariaSchema.partial().omit({ id: true });

export type MaquinariaDto = z.infer<typeof MaquinariaSchema>;
export type CreateMaquinariaDto = z.infer<typeof CreateMaquinariaSchema>;
export type UpdateMaquinariaDto = z.infer<typeof UpdateMaquinariaSchema>;