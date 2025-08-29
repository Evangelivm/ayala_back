import { z } from 'zod';

// Schema para sectores anidados
export const SectorSchema = z.object({
  id: z.number().optional(),
  nombre: z.string().min(1, 'El nombre del sector es requerido'),
  descripcion: z.string().optional(),
  ubicacion: z.string().optional(),
  frentes: z.array(z.object({
    id: z.number().optional(),
    nombre: z.string().min(1, 'El nombre del frente es requerido'),
    descripcion: z.string().optional(),
    responsable: z.string().optional(),
    partidas: z.array(z.object({
      id: z.number().optional(),
      codigo: z.string().min(1, 'El código de partida es requerido'),
      descripcion: z.string().min(1, 'La descripción de partida es requerida'),
      unidad_medida: z.string().optional(),
      cantidad: z.number().min(0, 'La cantidad debe ser positiva'),
      precio_unitario: z.number().min(0, 'El precio unitario debe ser positivo').optional(),
      total: z.number().min(0, 'El total debe ser positivo').optional(),
    })).optional().default([]),
  })).optional().default([]),
});

// Schema principal para proyectos actualizado con la estructura de BD
export const ProyectoSchema = z.object({
  id: z.number().optional(),
  nombre: z.string().min(1, 'El nombre del proyecto es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  descripcion: z.string().optional(),
  fecha_inicio: z.string().optional(), // Fecha en formato ISO string
  fecha_fin: z.string().optional(), // Fecha en formato ISO string
  estado: z.enum(['activo', 'inactivo', 'finalizado']).optional().default('activo'),
  activo: z.boolean().default(true),
  sectores: z.array(SectorSchema).optional().default([]),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  
  // Campos de compatibilidad con el frontend existente
  cliente: z.string().optional(), // Mapear a descripcion
  ubicacion: z.string().optional(), // Para compatibilidad
  etapas: z.array(z.string()).optional().default([]), // Para compatibilidad
});

// Schema para creación de proyecto
export const CreateProyectoSchema = ProyectoSchema.omit({ 
  id: true, 
  created_at: true, 
  updated_at: true 
});

// Schema para actualización de proyecto
export const UpdateProyectoSchema = ProyectoSchema.partial().omit({ 
  id: true, 
  created_at: true, 
  updated_at: true 
});

// Schema para respuesta de proyecto con toda la información
export const ProyectoResponseSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  fecha_inicio: z.string().nullable(),
  fecha_fin: z.string().nullable(),
  estado: z.enum(['activo', 'inactivo', 'finalizado']),
  activo: z.boolean(),
  sectores: z.array(z.object({
    id: z.number(),
    nombre: z.string(),
    descripcion: z.string().nullable(),
    ubicacion: z.string().nullable(),
    frentes: z.array(z.object({
      id: z.number(),
      nombre: z.string(),
      descripcion: z.string().nullable(),
      responsable: z.string().nullable(),
      partidas: z.array(z.object({
        id: z.number(),
        codigo: z.string(),
        descripcion: z.string(),
        unidad_medida: z.string().nullable(),
        cantidad: z.number(),
        precio_unitario: z.number().nullable(),
        total: z.number().nullable(),
      })).optional(),
    })),
  })),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

// Schema para filtros de búsqueda
export const ProyectoFilterSchema = z.object({
  nombre: z.string().optional(),
  estado: z.enum(['activo', 'inactivo', 'finalizado']).optional(),
  fecha_inicio_desde: z.string().optional(),
  fecha_inicio_hasta: z.string().optional(),
  fecha_fin_desde: z.string().optional(),
  fecha_fin_hasta: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

// Tipos TypeScript derivados de los schemas
export type ProyectoDto = z.infer<typeof ProyectoSchema>;
export type CreateProyectoDto = z.infer<typeof CreateProyectoSchema>;
export type UpdateProyectoDto = z.infer<typeof UpdateProyectoSchema>;
export type ProyectoResponseDto = z.infer<typeof ProyectoResponseSchema>;
export type ProyectoFilterDto = z.infer<typeof ProyectoFilterSchema>;
export type SectorDto = z.infer<typeof SectorSchema>;