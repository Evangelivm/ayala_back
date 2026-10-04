import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { NumeracionOrdenService, TipoOrden } from './numeracion-orden.service';

const Propietario = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Propietario inválido');
const Numeros = z.array(z.string().max(30)).max(50);

const ReservarSchema = z.object({ propietario: Propietario }).strip();
const RenovarSchema = z
  .object({ propietario: Propietario, numeros: Numeros })
  .strip();
const LiberarSchema = z
  .object({ propietario: Propietario, numeros: Numeros.optional() })
  .strip();

@Controller('numeracion-orden')
export class NumeracionOrdenController {
  constructor(private readonly numeracion: NumeracionOrdenService) {}

  @Post(':tipo/reservar')
  @HttpCode(HttpStatus.OK)
  reservar(
    @Param('tipo') tipo: TipoOrden,
    @Body(new ZodValidationPipe(ReservarSchema))
    body: z.infer<typeof ReservarSchema>,
  ) {
    return this.numeracion.reservar(tipo, body.propietario);
  }

  @Post(':tipo/renovar')
  @HttpCode(HttpStatus.OK)
  async renovar(
    @Param('tipo') tipo: TipoOrden,
    @Body(new ZodValidationPipe(RenovarSchema))
    body: z.infer<typeof RenovarSchema>,
  ) {
    const numeros = await this.numeracion.renovar(
      tipo,
      body.propietario,
      body.numeros,
    );
    return { numeros };
  }

  @Post(':tipo/liberar')
  @HttpCode(HttpStatus.OK)
  async liberar(
    @Param('tipo') tipo: TipoOrden,
    @Body(new ZodValidationPipe(LiberarSchema))
    body: z.infer<typeof LiberarSchema>,
  ) {
    await this.numeracion.liberar(tipo, body.propietario, body.numeros);
    return { ok: true };
  }
}
