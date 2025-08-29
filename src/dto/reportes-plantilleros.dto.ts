import { z } from 'zod';

// Schema principal para reportes de plantilleros
export const ReportesPlantillerosSchema = z.object({
  codigo_reporte: z.string().min(1, 'Código de reporte es requerido').max(50),
  id_proyecto: z.number().positive('ID de proyecto debe ser positivo').optional(),
  fecha: z.string().datetime('Fecha debe ser válida'),
  comentarios: z.string().optional(),
  
  // Campos con IDs
  id_personal: z.number().positive('ID de personal debe ser positivo').optional(),
  id_etapa: z.number().positive('ID de etapa debe ser positivo').optional(),
  id_frente: z.number().positive('ID de frente debe ser positivo').optional(),
  id_maquinaria: z.number().positive('ID de maquinaria debe ser positivo').optional(),
  
  // Campos de texto
  cargo: z.string().max(100).optional(),
  sector: z.string().max(100).optional(),
  hora_inicio: z.string().max(8).optional(),
  hora_fin: z.string().max(8).optional(),
  material: z.string().max(100).optional(),
  partida: z.string().max(50).optional(),
});

// Schema para actualización
export const UpdateReportesPlantillerosSchema = ReportesPlantillerosSchema.partial().extend({
  id_reporte: z.number().positive('ID de reporte es requerido'),
});

// Schema para búsqueda/filtros
export const ReportesPlantillerosFilterSchema = z.object({
  fecha_desde: z.string().datetime().optional(),
  fecha_hasta: z.string().datetime().optional(),
  id_proyecto: z.number().positive().optional(),
  codigo_reporte: z.string().optional(),
  responsable: z.string().optional(),
  activo: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

// Tipos TypeScript derivados de los schemas
export type ReportesPlantillerosDto = z.infer<typeof ReportesPlantillerosSchema>;
export type UpdateReportesPlantillerosDto = z.infer<typeof UpdateReportesPlantillerosSchema>;
export type ReportesPlantillerosFilterDto = z.infer<typeof ReportesPlantillerosFilterSchema>;

// Schema para respuesta de API
export const ReportesPlantillerosResponseSchema = z.object({
  id_reporte: z.number(),
  codigo_reporte: z.string(),
  id_proyecto: z.number().nullable(),
  fecha: z.string(),
  comentarios: z.string().nullable(),
  activo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  
  // Campos con IDs
  id_personal: z.number().nullable(),
  id_etapa: z.number().nullable(),
  id_frente: z.number().nullable(),
  id_maquinaria: z.number().nullable(),
  
  // Campos de texto
  cargo: z.string().nullable(),
  sector: z.string().nullable(),
  hora_inicio: z.string().nullable(),
  hora_fin: z.string().nullable(),
  material: z.string().nullable(),
  partida: z.string().nullable(),
  
  proyecto: z.object({
    id_proyecto: z.number(),
    nombre: z.string(),
  }).nullable(),
});

export type ReportesPlantillerosResponse = z.infer<typeof ReportesPlantillerosResponseSchema>;