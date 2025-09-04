import { z } from 'zod';

export const InformeConsumoCombustibleFilterSchema = z.object({
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  id_equipo: z.number().optional(),
});

export type InformeConsumoCombustibleFilterDto = z.infer<typeof InformeConsumoCombustibleFilterSchema>;

export interface InformeConsumoCombustibleResponse {
  fecha_emision: Date;
  almacenes: string;
  numero_factura: string;
  nombre: string;
  glosa: string;
  guia_remision: string;
  codigo_vale: string;
  placa: string;
  cantidad: number;
  descripcion: string;
  km: number;
  odometro: number;
  val_unit: number;
  total: number;
}