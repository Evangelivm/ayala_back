import { z } from 'zod';

// Schema para validar los parámetros de consulta del dashboard
export const GetActivityQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional().default('week'),
});

export const GetRecentReportsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => Math.max(1, Math.min(50, parseInt(val) || 10))),
});

// Tipos TypeScript basados en los schemas
export type GetActivityQueryDto = z.infer<typeof GetActivityQuerySchema>;
export type GetRecentReportsQueryDto = z.infer<typeof GetRecentReportsQuerySchema>;

// Schema para la respuesta de estadísticas del dashboard
export const DashboardStatsSchema = z.object({
  reportesViajes: z.object({
    total: z.number(),
    hoy: z.number(),
    ultimaSemana: z.number(),
    ultimoMes: z.number(),
  }),
  reportesPlantilleros: z.object({
    total: z.number(),
    hoy: z.number(),
    ultimaSemana: z.number(),
    ultimoMes: z.number(),
  }),
  reportesOperadores: z.object({
    total: z.number(),
    hoy: z.number(),
    ultimaSemana: z.number(),
    ultimoMes: z.number(),
  }),
  proyectosActivos: z.number(),
  personalActivo: z.number(),
  equiposDisponibles: z.number(),
  totalHorasOperacion: z.number(),
  totalViajes: z.number(),
  totalM3: z.number(),
});

export type DashboardStatsDto = z.infer<typeof DashboardStatsSchema>;

// Schema para reporte reciente
export const RecentReportSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  tipo: z.enum(['viajes', 'plantilleros', 'operadores']),
  fecha: z.string(),
  proyecto: z.string().optional(),
  responsable: z.string().optional(),
});

export type RecentReportDto = z.infer<typeof RecentReportSchema>;

// Schema para datos de actividad
export const ActivityDataSchema = z.object({
  period: z.enum(['day', 'week', 'month']),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  data: z.object({
    viajes: z.number(),
    plantilleros: z.number(),
    operadores: z.number(),
    total: z.number(),
  }),
});

export type ActivityDataDto = z.infer<typeof ActivityDataSchema>;

// Schema para proyecto activo
export const ActiveProjectSchema = z.object({
  id_proyecto: z.number(),
  nombre: z.string(),
  cliente: z.string(),
  ubicacion: z.string(),
  created_at: z.date(),
});

export type ActiveProjectDto = z.infer<typeof ActiveProjectSchema>;