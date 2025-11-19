import { Controller, Get, Param, HttpException, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { RubroService } from './rubro.service';

@Controller('rubro')
export class RubroController {
  constructor(private readonly rubroService: RubroService) {}

  @Get()
  async findAll() {
    return this.rubroService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const rubro = await this.rubroService.findOne(id);
    if (!rubro) {
      throw new HttpException('Rubro no encontrado', HttpStatus.NOT_FOUND);
    }
    return rubro;
  }

  @Get('codigo/:codigo')
  async findByCodigo(@Param('codigo') codigo: string) {
    const rubro = await this.rubroService.findByCodigo(codigo);
    if (!rubro) {
      throw new HttpException('Rubro no encontrado', HttpStatus.NOT_FOUND);
    }
    return rubro;
  }
}
