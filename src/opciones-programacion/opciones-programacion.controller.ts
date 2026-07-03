import { Controller, Get, Post, Put, Delete, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { OpcionesProgramacionService } from './opciones-programacion.service';

@Controller('opciones-programacion')
export class OpcionesProgramacionController {
  constructor(private readonly service: OpcionesProgramacionService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  async create(@Body() body: { nombre: string }) {
    if (!body.nombre?.trim()) {
      throw new HttpException('El nombre es requerido', HttpStatus.BAD_REQUEST);
    }
    return this.service.create(body.nombre);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: { nombre: string }) {
    if (!body.nombre?.trim()) {
      throw new HttpException('El nombre es requerido', HttpStatus.BAD_REQUEST);
    }
    return this.service.update(+id, body.nombre);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
