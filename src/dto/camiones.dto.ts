import { z } from 'zod';

// Schema principal para camiones
export const CamionSchema = z.object({
  id_camion: z.number().optional(),
  placa: z.string().min(1, 'La placa es requerida').max(10, 'La placa no puede exceder 10 caracteres'),
  marca: z.string().max(50, 'La marca no puede exceder 50 caracteres').optional().nullable(),
  modelo: z.string().max(50, 'El modelo no puede exceder 50 caracteres').optional().nullable(),
  año: z.number().int().min(1900).max(2100).optional().nullable(),
  capacidad_tanque: z.number().positive('La capacidad del tanque debe ser mayor a 0').optional().nullable(),
  id_tipo_combustible_preferido: z.number().int().optional().nullable(),
  activo: z.boolean().default(true).optional(),
  fecha_registro: z.string().optional(),
  dni: z.string().max(255, 'El DNI no puede exceder 255 caracteres').optional().nullable(),
  nombre_chofer: z.string().max(255, 'El nombre del chofer no puede exceder 255 caracteres').optional().nullable(),
  apellido_chofer: z.string().max(255, 'El apellido del chofer no puede exceder 255 caracteres').optional().nullable(),
  numero_licencia: z.string().max(255, 'El número de licencia no puede exceder 255 caracteres').optional().nullable(),
  empresa: z.string().max(255, 'El código de empresa no puede exceder 255 caracteres').optional().nullable(),
  tipo: z.enum(['CAMION', 'MAQUINARIA'], { required_error: 'El tipo es requerido' }),
});

// Schema para creación de camiones
export const CreateCamionSchema = CamionSchema.omit({
  id_camion: true,
  fecha_registro: true,
});

// Schema para actualización de camiones
export const UpdateCamionSchema = CamionSchema.partial().omit({
  id_camion: true,
  fecha_registro: true,
});

// Schema para respuesta de camiones
export const CamionResponseSchema = z.object({
  id_camion: z.number(),
  placa: z.string(),
  marca: z.string().nullable(),
  modelo: z.string().nullable(),
  año: z.number().nullable(),
  capacidad_tanque: z.number().nullable(),
  id_tipo_combustible_preferido: z.number().nullable(),
  activo: z.boolean(),
  fecha_registro: z.string().nullable(),
  dni: z.string().nullable(),
  nombre_chofer: z.string().nullable(),
  apellido_chofer: z.string().nullable(),
  numero_licencia: z.string().nullable(),
  empresa: z.string().nullable(),
  tipo: z.enum(['CAMION', 'MAQUINARIA']),
});

// Schema para filtros de búsqueda
export const CamionFilterSchema = z.object({
  placa: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  activo: z.boolean().optional(),
  dni: z.string().optional(),
  nombre_chofer: z.string().optional(),
});

// Tipos TypeScript derivados de los schemas
export type CamionDto = z.infer<typeof CamionSchema>;
export type CreateCamionDto = z.infer<typeof CreateCamionSchema>;
export type UpdateCamionDto = z.infer<typeof UpdateCamionSchema>;
export type CamionResponseDto = z.infer<typeof CamionResponseSchema>;
export type CamionFilterDto = z.infer<typeof CamionFilterSchema>;
