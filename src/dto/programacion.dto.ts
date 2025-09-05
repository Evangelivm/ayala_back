import { z } from 'zod';

// Schema para un item de programación individual
export const ProgramacionItemSchema = z.object({
  fecha: z.union([
    z.string().refine((date) => !isNaN(Date.parse(date)), 'Fecha debe ser válida'),
    z.date()
  ]).transform((val) => typeof val === 'string' ? new Date(val) : val),
  unidad: z.string().min(1, 'Unidad es requerida').max(255, 'Unidad no puede exceder 255 caracteres'),
  apellidos_nombres: z.string().min(1, 'Apellidos y nombres son requeridos').max(255, 'Apellidos y nombres no pueden exceder 255 caracteres'),
  proyectos: z.string().min(1, 'Proyectos es requerido').max(255, 'Proyectos no puede exceder 255 caracteres'),
  programacion: z.string().min(1, 'Programación es requerida').max(255, 'Programación no puede exceder 255 caracteres'),
  hora_partida: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Hora debe estar en formato HH:MM o HH:MM:SS')
    .transform((val) => {
      // Asegurar formato TIME HH:MM:SS
      const parts = val.split(':');
      if (parts.length === 2) {
        return `${val}:00`;
      }
      return val;
    }),
  estado_programacion: z.string().min(1, 'Estado de programación es requerido').max(255, 'Estado de programación no puede exceder 255 caracteres'),
  comentarios: z.string().max(500, 'Comentarios no pueden exceder 500 caracteres').optional()
    .transform((val) => val === '' ? undefined : val),
});

// Schema principal para crear programación masiva
export const CreateProgramacionSchema = z.object({
  data: z.array(ProgramacionItemSchema).min(1, 'Debe proporcionar al menos un registro').max(1000, 'No se pueden procesar más de 1000 registros a la vez'),
});

// Schema para respuesta de programación
export const ProgramacionResponseSchema = z.object({
  message: z.string(),
  totalRecords: z.number(),
  successCount: z.number(),
  processingTime: z.number(),
});

// Schema para obtener programación con paginación
export const ProgramacionFilterSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  unidad: z.string().optional(),
  estado_programacion: z.string().optional(),
});

// Schema para respuesta individual de programación
export const ProgramacionSchema = z.object({
  id: z.number(),
  fecha: z.date().nullable(),
  unidad: z.string().nullable(),
  apellidos_nombres: z.string().nullable(),
  proyectos: z.string().nullable(),
  programacion: z.string().nullable(),
  hora_partida: z.date().nullable(),
  estado_programacion: z.string().nullable(),
  comentarios: z.string().nullable(),
});

// Tipos TypeScript derivados de los schemas
export type ProgramacionItemDto = z.infer<typeof ProgramacionItemSchema>;
export type CreateProgramacionDto = z.infer<typeof CreateProgramacionSchema>;
export type ProgramacionResponseDto = z.infer<typeof ProgramacionResponseSchema>;
export type ProgramacionFilterDto = z.infer<typeof ProgramacionFilterSchema>;
export type ProgramacionDto = z.infer<typeof ProgramacionSchema>;