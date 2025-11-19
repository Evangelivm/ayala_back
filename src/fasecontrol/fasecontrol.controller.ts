import { Controller, Get, Param, HttpException, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { FasecontrolService } from './fasecontrol.service';

@Controller('fasecontrol')
export class FasecontrolController {
  constructor(private readonly fasecontrolService: FasecontrolService) {}

  @Get()
  async findAll() {
    return this.fasecontrolService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const fase = await this.fasecontrolService.findOne(id);
    if (!fase) {
      throw new HttpException('Fase control no encontrada', HttpStatus.NOT_FOUND);
    }
    return fase;
  }

  @Get('codigo/:codigo')
  async findByCodigo(@Param('codigo') codigo: string) {
    const fase = await this.fasecontrolService.findByCodigo(codigo);
    if (!fase) {
      throw new HttpException('Fase control no encontrada', HttpStatus.NOT_FOUND);
    }
    return fase;
  }
}
