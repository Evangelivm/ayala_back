import { Controller, Get, Param, HttpException, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { CentroproyectoService } from './centroproyecto.service';

@Controller('centroproyecto')
export class CentroproyectoController {
  constructor(private readonly centroproyectoService: CentroproyectoService) {}

  @Get()
  async findAll() {
    return this.centroproyectoService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const centro = await this.centroproyectoService.findOne(id);
    if (!centro) {
      throw new HttpException('Centro proyecto no encontrado', HttpStatus.NOT_FOUND);
    }
    return centro;
  }

  @Get('codigo/:codigo')
  async findByCodigo(@Param('codigo') codigo: string) {
    const centro = await this.centroproyectoService.findByCodigo(codigo);
    if (!centro) {
      throw new HttpException('Centro proyecto no encontrado', HttpStatus.NOT_FOUND);
    }
    return centro;
  }
}
