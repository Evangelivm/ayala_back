import { z } from 'zod';

// Schema para horarios individuales
export const DetalleHorarioSchema = z.object({
  numero_entrada: z.number().min(1).max(8),
  hora_inicio: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido').optional(),
  hora_salida: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido').optional(),
});

// Schema para detalle de viajes
export const DetalleViajeSchema = z.object({
  item: z.number().min(1),
  conductor: z.string().min(1, 'Conductor es requerido').max(100),
  placa: z.string().min(1, 'Placa es requerida').max(20),
  viajes: z.number().min(0).default(0),
  m3_tolva: z.number().min(0).optional(),
  horarios: z.array(DetalleHorarioSchema).max(8, 'Máximo 8 horarios por viaje'),
});

// Schema principal para viajes de eliminación
export const ViajesEliminacionSchema = z.object({
  codigo_reporte: z.string().min(1, 'Código de reporte es requerido').max(50),
  id_proyecto: z.number().positive('ID de proyecto debe ser positivo').optional(),
  fecha: z.string().datetime('Fecha debe ser válida'),
  // IDs de personal (foreign keys)
  id_responsable: z.number().positive('ID de responsable debe ser positivo').optional(),
  id_operador: z.number().positive('ID de operador debe ser positivo').optional(),
  id_vigia: z.number().positive('ID de vigía debe ser positivo').optional(),
  id_mantero: z.number().positive('ID de mantero debe ser positivo').optional(),
  id_controlador: z.number().positive('ID de controlador debe ser positivo').optional(),
  id_capataz: z.number().positive('ID de capataz debe ser positivo').optional(),
  // Campos legacy (mantenidos por compatibilidad)
  nombre_responsable: z.string().max(100).optional(),
  operador: z.string().max(100).optional(),
  maquinaria_pesada: z.string().max(100).optional(),
  vigia: z.string().max(100).optional(),
  mantero: z.string().max(100).optional(),
  controlador: z.string().max(100).optional(),
  capataz: z.string().max(100).optional(),
  comentarios: z.string().optional(),
  detalle_viajes: z.array(DetalleViajeSchema).min(1, 'Debe incluir al menos un detalle de viaje'),
});

// Schema para actualización (todos los campos opcionales excepto ID)
export const UpdateViajesEliminacionSchema = ViajesEliminacionSchema.partial().extend({
  id_viaje: z.number().positive('ID de viaje es requerido'),
});

// Schema para búsqueda/filtros
export const ViajesEliminacionFilterSchema = z.object({
  fecha_desde: z.string().datetime().optional(),
  fecha_hasta: z.string().datetime().optional(),
  id_proyecto: z.number().positive().optional(),
  codigo_reporte: z.string().optional(),
  activo: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

// Tipos TypeScript derivados de los schemas
export type ViajesEliminacionDto = z.infer<typeof ViajesEliminacionSchema>;
export type UpdateViajesEliminacionDto = z.infer<typeof UpdateViajesEliminacionSchema>;
export type ViajesEliminacionFilterDto = z.infer<typeof ViajesEliminacionFilterSchema>;
export type DetalleViajeDto = z.infer<typeof DetalleViajeSchema>;
export type DetalleHorarioDto = z.infer<typeof DetalleHorarioSchema>;

// Schema para respuesta de API
export const ViajesEliminacionResponseSchema = z.object({
  id_viaje: z.number(),
  codigo_reporte: z.string(),
  id_proyecto: z.number().nullable(),
  fecha: z.string(),
  nombre_responsable: z.string().nullable(),
  operador: z.string().nullable(),
  maquinaria_pesada: z.string().nullable(),
  vigia: z.string().nullable(),
  mantero: z.string().nullable(),
  controlador: z.string().nullable(),
  capataz: z.string().nullable(),
  comentarios: z.string().nullable(),
  activo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  proyecto: z.object({
    id_proyecto: z.number(),
    nombre: z.string(),
  }).nullable(),
  detalle_viajes: z.array(z.object({
    id_detalle: z.number(),
    item: z.number(),
    conductor: z.string(),
    placa: z.string(),
    viajes: z.number(),
    m3_tolva: z.number().nullable(),
    detalle_horarios: z.array(z.object({
      id_horario: z.number(),
      numero_entrada: z.number(),
      hora_inicio: z.string().nullable(),
      hora_salida: z.string().nullable(),
    })),
  })),
});

export type ViajesEliminacionResponse = z.infer<typeof ViajesEliminacionResponseSchema>;