import { z } from 'zod';

export const ProveedorSchema = z.object({
  id_proveedor: z.number(),
  codigo_proveedor: z.string(),
  nombre_proveedor: z.string(),
  contacto: z.string().nullable(),
  telefono: z.string().nullable(),
  email: z.string().nullable(),
  direccion: z.string().nullable(),
  ruc: z.string().nullable(),
  activo: z.boolean().nullable(),
  fecha_registro: z.date().nullable(),
  fecha_actualizacion: z.date().nullable(),
});

export type ProveedorDto = z.infer<typeof ProveedorSchema>;
