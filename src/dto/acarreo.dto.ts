import { z } from 'zod';

// Schema para un item de acarreo individual
export const AcarreoItemSchema = z.object({
  fecha: z.union([
    z.string().refine((date) => !isNaN(Date.parse(date)), 'Fecha debe ser válida'),
    z.date()
  ]).transform((val) => typeof val === 'string' ? new Date(val) : val),
  unidad: z.number().int().positive('Unidad debe ser un ID de camión válido'),
  proveedor: z.string().min(1, 'Proveedor es requerido').max(255, 'Proveedor no puede exceder 255 caracteres'),
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
  estado_programacion: z.string().max(255, 'Estado de programación no puede exceder 255 caracteres').optional()
    .transform((val) => val === '' ? undefined : val),
  comentarios: z.string().max(500, 'Comentarios no pueden exceder 500 caracteres').optional()
    .transform((val) => val === '' ? undefined : val),
  punto_partida_ubigeo: z.string().min(1, 'Ubigeo de partida es requerido').max(255),
  punto_partida_direccion: z.string().min(1, 'Dirección de partida es requerida').max(255),
  punto_llegada_ubigeo: z.string().min(1, 'Ubigeo de llegada es requerido').max(255),
  punto_llegada_direccion: z.string().min(1, 'Dirección de llegada es requerida').max(255),
  peso: z.string().max(255, 'Peso no puede exceder 255 caracteres').optional()
    .transform((val) => val === '' ? undefined : val),
  id_proyecto: z.number().int().positive('ID de proyecto debe ser un número positivo').optional(),
  id_subproyecto: z.number().int().positive('ID de subproyecto debe ser un número positivo').optional(),
});

// Schema principal para crear acarreo masivo
export const CreateAcarreoSchema = z.object({
  data: z.array(AcarreoItemSchema).min(1, 'Debe proporcionar al menos un registro').max(1000, 'No se pueden procesar más de 1000 registros a la vez'),
});

// Schema para respuesta de acarreo
export const AcarreoResponseSchema = z.object({
  message: z.string(),
  totalRecords: z.number(),
  successCount: z.number(),
  successCountTecnica: z.number().optional(),
  processingTime: z.number(),
});

// Schema para obtener acarreo con paginación
export const AcarreoFilterSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  unidad: z.string().optional(),
  estado_programacion: z.string().optional(),
});

// Schema para respuesta individual de acarreo
export const AcarreoSchema = z.object({
  id: z.number(),
  fecha: z.date().nullable(),
  unidad: z.number().nullable(),
  proveedor: z.string().nullable(),
  programacion: z.string().nullable(),
  hora_partida: z.date().nullable(),
  estado_programacion: z.string().nullable(),
  comentarios: z.string().nullable(),
  identificador_unico: z.string().nullable(),
  km_del_dia: z.string().nullable(),
  mes: z.string().nullable(),
  num_semana: z.string().nullable(),
  peso: z.string().nullable(),
  punto_partida_ubigeo: z.string().nullable(),
  punto_partida_direccion: z.string().nullable(),
  punto_llegada_ubigeo: z.string().nullable(),
  punto_llegada_direccion: z.string().nullable(),
});

// Tipos TypeScript derivados de los schemas
export type AcarreoItemDto = z.infer<typeof AcarreoItemSchema>;
export type CreateAcarreoDto = z.infer<typeof CreateAcarreoSchema>;
export type AcarreoResponseDto = z.infer<typeof AcarreoResponseSchema>;
export type AcarreoFilterDto = z.infer<typeof AcarreoFilterSchema>;
export type AcarreoDto = z.infer<typeof AcarreoSchema>;
