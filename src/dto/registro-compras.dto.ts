import { z } from 'zod';

const dateLike = z.union([
  z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), 'Fecha debe ser válida'),
  z.date(),
]);

// Schema para una línea de asiento (una fila de la tabla masivo)
export const MasivoRowSchema = z.object({
  campo: z.number().int().positive(),
  sub_diario: z.number().int().positive(),
  num_comprobante: z.string().min(1).max(20),
  fecha_documento: dateLike.transform((val) =>
    typeof val === 'string' ? new Date(val) : val,
  ),
  fecha_vencimiento: dateLike.transform((val) =>
    typeof val === 'string' ? new Date(val) : val,
  ),
  tipo_documento: z.string().max(10).optional(),
  numero_documento: z.string().max(50).optional(),
  codigo_anexo: z.string().max(20).optional(),
  glosa_principal: z.string().max(100).optional(),
  importe_original: z.number(),
  debe_haber: z.enum(['D', 'H']),
  cod_moneda: z.string().min(1).max(5),
  tasa_igv: z.string().max(5).optional(),
  cuenta_contable: z.string().min(1).max(20),
  codigo_auxiliar: z.string().max(20).optional(),
  tipo_doc_referencia: z.string().max(10).optional(),
  num_doc_referencia: z.string().max(20).optional(),
  fecha_doc_referencia: dateLike
    .optional()
    .transform((val) =>
      val === undefined
        ? undefined
        : typeof val === 'string'
          ? new Date(val)
          : val,
    ),
  tipo_conversion: z.string().max(5).optional(),
  flag_conversion: z.string().max(5).optional(),
});

export const CreateMasivoSchema = z.object({
  data: z
    .array(MasivoRowSchema)
    .min(1, 'Debe proporcionar al menos un registro')
    .max(5000, 'No se pueden procesar más de 5000 líneas a la vez'),
});

export const MasivoResponseSchema = z.object({
  message: z.string(),
  totalRecords: z.number(),
  successCount: z.number(),
  processingTime: z.number(),
  first_reg: z.number().nullable(),
  last_reg: z.number().nullable(),
});

export type MasivoRowDto = z.infer<typeof MasivoRowSchema>;
export type CreateMasivoDto = z.infer<typeof CreateMasivoSchema>;
export type MasivoResponseDto = z.infer<typeof MasivoResponseSchema>;
