import { Controller, Get } from '@nestjs/common';
import { TipoDetraccionService } from './tipo-detraccion.service';

@Controller('tipo-detraccion')
export class TipoDetraccionController {
  constructor(private readonly tipoDetraccionService: TipoDetraccionService) {}

  @Get()
  async findAll() {
    return this.tipoDetraccionService.findAll();
  }
}
