import { z } from 'zod';

// Schema principal para empresas_2025
export const EmpresaSchema = z.object({
  C_digo: z.string().min(1, 'El código es requerido').max(255),
  Raz_n_social: z.string().max(255).optional().nullable(),
  N__documento: z.string().max(255).optional().nullable(),
  Tipo: z.string().max(255).optional().nullable(),
  Direcci_n: z.string().max(255).optional().nullable(),
});

// Schema para creación de empresas
export const CreateEmpresaSchema = EmpresaSchema;

// Schema para actualización de empresas
export const UpdateEmpresaSchema = EmpresaSchema.partial().omit({
  C_digo: true,
});

// Schema para respuesta de empresas
export const EmpresaResponseSchema = z.object({
  C_digo: z.string(),
  Raz_n_social: z.string().nullable(),
  N__documento: z.string().nullable(),
  Tipo: z.string().nullable(),
  Direcci_n: z.string().nullable(),
});

// Schema para filtros de búsqueda
export const EmpresaFilterSchema = z.object({
  Raz_n_social: z.string().optional(),
  N__documento: z.string().optional(),
  Tipo: z.string().optional(),
});

// Tipos TypeScript derivados de los schemas
export type EmpresaDto = z.infer<typeof EmpresaSchema>;
export type CreateEmpresaDto = z.infer<typeof CreateEmpresaSchema>;
export type UpdateEmpresaDto = z.infer<typeof UpdateEmpresaSchema>;
export type EmpresaResponseDto = z.infer<typeof EmpresaResponseSchema>;
export type EmpresaFilterDto = z.infer<typeof EmpresaFilterSchema>;
