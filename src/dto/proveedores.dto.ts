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

// DTO para crear un proveedor (sin codigo_proveedor porque se genera automáticamente)
export const CreateProveedorSchema = z.object({
  nombre_proveedor: z.string().min(1, 'El nombre del proveedor es obligatorio'),
  ruc: z.string().min(11, 'El RUC debe tener 11 dígitos').max(11, 'El RUC debe tener 11 dígitos'),
  contacto: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  direccion: z.string().optional().nullable(),
  entidad_bancaria: z.string().optional().nullable(),
  numero_cuenta_bancaria: z.string().optional().nullable(),
  retencion: z.enum(['Si', 'No']).optional().nullable(),
  es_agente_retencion: z.enum(['1', '0']).optional().nullable(),
  activo: z.boolean().optional().default(true),
});

export type CreateProveedorDto = z.infer<typeof CreateProveedorSchema>;
