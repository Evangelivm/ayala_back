import { z } from 'zod';
import { CreateFacturaSchema } from './create-factura.dto';

// Schema para actualizar una factura
// Solo permite actualizar facturas en estado NULL o FALLADO
export const UpdateFacturaSchema = CreateFacturaSchema.partial();

// Tipo inferido
export type UpdateFacturaDto = z.infer<typeof UpdateFacturaSchema>;
