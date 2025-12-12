import { Decimal } from '@prisma/client/runtime/library';

export interface IFacturaItem {
  id_factura_item: number;
  id_factura: number;
  codigo_item?: string | null;
  codigo_producto_sunat?: string | null;
  descripcion_item: string;
  unidad_medida: string;
  cantidad: Decimal;
  valor_unitario: Decimal;
  precio_unitario: Decimal;
  descuento?: Decimal | null;
  subtotal: Decimal;
  tipo_de_igv: number;
  igv: Decimal;
  tipo_de_isc?: number | null;
  isc?: Decimal | null;
  total: Decimal;
  anticipo_regularizacion: boolean;
  anticipo_documento_serie?: string | null;
  anticipo_documento_numero?: number | null;
  created_at: Date;
  updated_at: Date;
}
