import { z } from 'zod';

// Schema para el enum de tipo de equipo
export const TipoEquipoSchema = z.enum([
  'EXCAVADORA',
  'CARGADOR', 
  'MINICARGADOR',
  'MOTONIVELADORA',
  'PAVIMENTADORA',
  'RODILLO',
  'VIBROAPRISIONADOR',
  'FLETE_TRANSPORTE',
  'COMPRESOR',
  'GRUA',
  'PLATAFORMA_ELEVADORA',
  'SERVICIO_PERSONAL',
  'SERVICIO_ESPECIALIZADO',
  'HERRAMIENTA_MANUAL',
  'EQUIPO_TOPOGRAFIA',
]);

// Schema principal para equipos
export const EquipoSchema = z.object({
  id_equipo: z.number().optional(),
  tipo_equipo: TipoEquipoSchema,
  marca: z.string().min(1, 'La marca es requerida').max(100, 'La marca no puede exceder 100 caracteres'),
  modelo: z.string().min(1, 'El modelo es requerido').max(100, 'El modelo no puede exceder 100 caracteres'),
  descripcion: z.string().max(500, 'La descripción no puede exceder 500 caracteres').optional(),
  unidad: z.string().min(1, 'La unidad es requerida').max(50, 'La unidad no puede exceder 50 caracteres'),
  precio_referencial: z.number().positive('El precio debe ser mayor a 0'),
  activo: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// Schema para creación de equipos
export const CreateEquipoSchema = EquipoSchema.omit({ 
  id_equipo: true, 
  created_at: true, 
  updated_at: true 
});

// Schema para actualización de equipos
export const UpdateEquipoSchema = EquipoSchema.partial().omit({ 
  id_equipo: true, 
  created_at: true, 
  updated_at: true 
});

// Schema para respuesta de equipos
export const EquipoResponseSchema = z.object({
  id_equipo: z.number(),
  tipo_equipo: TipoEquipoSchema,
  marca: z.string(),
  modelo: z.string(),
  descripcion: z.string().nullable(),
  unidad: z.string(),
  precio_referencial: z.number(),
  activo: z.boolean(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  // Campo computado para display
  nombre_completo: z.string().optional(),
});

// Schema para filtros de búsqueda
export const EquipoFilterSchema = z.object({
  tipo_equipo: TipoEquipoSchema.optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  unidad: z.string().optional(),
  activo: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

// Tipos TypeScript derivados de los schemas
export type EquipoDto = z.infer<typeof EquipoSchema>;
export type CreateEquipoDto = z.infer<typeof CreateEquipoSchema>;
export type UpdateEquipoDto = z.infer<typeof UpdateEquipoSchema>;
export type EquipoResponseDto = z.infer<typeof EquipoResponseSchema>;
export type EquipoFilterDto = z.infer<typeof EquipoFilterSchema>;
export type TipoEquipo = z.infer<typeof TipoEquipoSchema>;