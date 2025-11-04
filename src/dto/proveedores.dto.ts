import { z } from 'zod';

export const ProveedorSchema = z.object({
  id: z.number(),
  codigo: z.string().nullable(),
  razon_social: z.string().nullable(),
  nro_documento: z.string().nullable(),
  tipo: z.string().nullable(),
  direccion: z.string().nullable(),
});

export type ProveedorDto = z.infer<typeof ProveedorSchema>;
