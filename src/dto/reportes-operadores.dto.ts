import { z } from 'zod';

// Schema para detalle de producción
export const DetalleProduccionSchema = z.object({
  item: z.number().min(1),
  sector: z.string().max(100).optional(),
  frente: z.string().max(100).optional(),
  descripcion: z.string().max(200).optional(),
  material: z.string().max(100).optional(),
  m3: z.number().min(0).optional(),
  viajes: z.number().int().min(0).optional(),
  horas_trabajadas: z.number().min(0).max(24).optional(),
});

// Schema principal para reportes de operadores
export const ReportesOperadoresSchema = z.object({
  codigo_reporte: z.string().min(1, 'Código de reporte es requerido').max(50),
  id_proyecto: z.number().positive('ID de proyecto debe ser positivo').optional(),
  fecha: z.string().datetime('Fecha debe ser válida'),
  // IDs de personal (foreign keys) - ACTUALIZADOS
  id_operador: z.number().positive('ID de operador debe ser positivo').optional(),
  id_vigia1: z.number().positive('ID de vigía 1 debe ser positivo').optional(),
  id_vigia2: z.number().positive('ID de vigía 2 debe ser positivo').optional(),
  id_vigia3: z.number().positive('ID de vigía 3 debe ser positivo').optional(),
  // NUEVOS CAMPOS AGREGADOS
  id_etapa: z.number().positive('ID de etapa debe ser positivo').optional(),
  id_equipo: z.number().positive('ID de equipo debe ser positivo').optional(),
  horario1: z.string().max(8).optional(),
  horario2: z.string().max(8).optional(),
  horario3: z.string().max(8).optional(),
  horometro_inicial: z.number().min(0).optional(),
  horometro_final: z.number().min(0).optional(),
  // NUEVO CAMPO AGREGADO
  id_maquinaria: z.number().positive('ID de maquinaria debe ser positivo').optional(),
  // Campos legacy (mantenidos por compatibilidad)
  operador: z.string().max(100).optional(),
  proyecto: z.string().max(100).optional(),
  codigo: z.string().max(50).optional(),
  detalle_produccion: z.array(DetalleProduccionSchema).optional().default([]),
});

// Schema para actualización
export const UpdateReportesOperadoresSchema = ReportesOperadoresSchema.partial().extend({
  id_reporte: z.number().positive('ID de reporte es requerido'),
});

// Schema para búsqueda/filtros
export const ReportesOperadoresFilterSchema = z.object({
  fecha_desde: z.string().datetime().optional(),
  fecha_hasta: z.string().datetime().optional(),
  id_proyecto: z.number().positive().optional(),
  codigo_reporte: z.string().optional(),
  operador: z.string().optional(),
  activo: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

// Tipos TypeScript derivados de los schemas
export type ReportesOperadoresDto = z.infer<typeof ReportesOperadoresSchema>;
export type UpdateReportesOperadoresDto = z.infer<typeof UpdateReportesOperadoresSchema>;
export type ReportesOperadoresFilterDto = z.infer<typeof ReportesOperadoresFilterSchema>;
export type DetalleProduccionDto = z.infer<typeof DetalleProduccionSchema>;

// Schema para respuesta de API
export const ReportesOperadoresResponseSchema = z.object({
  id_reporte: z.number(),
  codigo_reporte: z.string(),
  id_proyecto: z.number().nullable(),
  fecha: z.string(),
  // Personal actualizado
  operador: z.string().nullable(),
  vigia1: z.string().nullable(),
  vigia2: z.string().nullable(),
  vigia3: z.string().nullable(),
  // Nuevos campos
  etapa: z.string().nullable(),
  equipo: z.string().nullable(),
  horario1: z.string().nullable(),
  horario2: z.string().nullable(),
  horario3: z.string().nullable(),
  horometro_inicial: z.number().nullable(),
  horometro_final: z.number().nullable(),
  // Nuevos campos adicionales
  maquinaria: z.string().nullable(),
  // Campos legacy
  vigia: z.string().nullable(), // Legacy
  activo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  proyecto: z.object({
    id_proyecto: z.number(),
    nombre: z.string(),
  }).nullable(),
  detalle_produccion: z.array(z.object({
    id_detalle: z.number(),
    item: z.number(),
    sector: z.string().nullable(),
    frente: z.string().nullable(),
    descripcion: z.string().nullable(),
    material: z.string().nullable(),
    m3: z.number().nullable(),
    viajes: z.number().int().nullable(),
    horas_trabajadas: z.number().nullable(),
  })),
});

export type ReportesOperadoresResponse = z.infer<typeof ReportesOperadoresResponseSchema>;