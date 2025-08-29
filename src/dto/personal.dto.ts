import { z } from 'zod';

// Schema principal para personal (sin campo cargo - roles se determinan por contexto)
export const PersonalSchema = z.object({
  id_personal: z.number().optional(),
  nombres: z.string().min(1, 'Los nombres son requeridos').max(100, 'Los nombres no pueden exceder 100 caracteres'),
  apellidos: z.string().min(1, 'Los apellidos son requeridos').max(100, 'Los apellidos no pueden exceder 100 caracteres'),
  dni: z.string().min(8, 'DNI debe tener al menos 8 caracteres').max(20, 'DNI no puede exceder 20 caracteres'),
  telefono: z.string().max(20, 'El teléfono no puede exceder 20 caracteres').optional(),
  correo: z.string().email('Formato de correo inválido').max(100, 'El correo no puede exceder 100 caracteres').optional(),
  fecha_ingreso: z.string().refine((date) => !isNaN(Date.parse(date)), 'Fecha de ingreso debe ser válida'),
  activo: z.boolean().default(true),
  observaciones: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// Schema para creación de personal
export const CreatePersonalSchema = PersonalSchema.omit({ 
  id_personal: true, 
  created_at: true, 
  updated_at: true 
});

// Schema para actualización de personal
export const UpdatePersonalSchema = PersonalSchema.partial().omit({ 
  id_personal: true, 
  created_at: true, 
  updated_at: true 
});

// Schema para respuesta de personal
export const PersonalResponseSchema = z.object({
  id_personal: z.number(),
  nombres: z.string(),
  apellidos: z.string(),
  dni: z.string(),
  telefono: z.string().nullable(),
  correo: z.string().nullable(),
  fecha_ingreso: z.string(),
  activo: z.boolean(),
  observaciones: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  nombre_completo: z.string(), // Campo calculado
});

// Schema para filtros de búsqueda
export const PersonalFilterSchema = z.object({
  nombres: z.string().optional(),
  apellidos: z.string().optional(),
  dni: z.string().optional(),
  activo: z.boolean().optional(),
  fecha_ingreso_desde: z.string().optional(),
  fecha_ingreso_hasta: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

// Schema para asignaciones de personal a proyectos
export const AsignacionPersonalSchema = z.object({
  id_asignacion: z.number().optional(),
  id_personal: z.number().positive('ID de personal es requerido'),
  id_proyecto: z.number().positive('ID de proyecto es requerido'),
  fecha_asignacion: z.string().refine((date) => !isNaN(Date.parse(date)), 'Fecha de asignación debe ser válida'),
  fecha_fin: z.string().refine((date) => !isNaN(Date.parse(date)), 'Fecha de fin debe ser válida').optional(),
  activo: z.boolean().default(true),
  observaciones: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const CreateAsignacionPersonalSchema = AsignacionPersonalSchema.omit({ 
  id_asignacion: true, 
  created_at: true, 
  updated_at: true 
});

export const UpdateAsignacionPersonalSchema = AsignacionPersonalSchema.partial().omit({ 
  id_asignacion: true, 
  created_at: true, 
  updated_at: true 
});

// Schema para respuesta de asignación con datos relacionados
export const AsignacionPersonalResponseSchema = z.object({
  id_asignacion: z.number(),
  id_personal: z.number(),
  id_proyecto: z.number(),
  fecha_asignacion: z.string(),
  fecha_fin: z.string().nullable(),
  activo: z.boolean(),
  observaciones: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  personal: PersonalResponseSchema,
  proyecto: z.object({
    id_proyecto: z.number(),
    nombre: z.string(),
    estado: z.enum(['activo', 'inactivo', 'finalizado']),
  }),
});

// Tipos TypeScript derivados de los schemas
export type PersonalDto = z.infer<typeof PersonalSchema>;
export type CreatePersonalDto = z.infer<typeof CreatePersonalSchema>;
export type UpdatePersonalDto = z.infer<typeof UpdatePersonalSchema>;
export type PersonalResponseDto = z.infer<typeof PersonalResponseSchema>;
export type PersonalFilterDto = z.infer<typeof PersonalFilterSchema>;

export type AsignacionPersonalDto = z.infer<typeof AsignacionPersonalSchema>;
export type CreateAsignacionPersonalDto = z.infer<typeof CreateAsignacionPersonalSchema>;
export type UpdateAsignacionPersonalDto = z.infer<typeof UpdateAsignacionPersonalSchema>;
export type AsignacionPersonalResponseDto = z.infer<typeof AsignacionPersonalResponseSchema>;