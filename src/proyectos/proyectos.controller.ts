import { Controller, Get, Post, Body, Param, Put, Delete, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { CreateProyectoSchema, UpdateProyectoSchema, type CreateProyectoDto, type UpdateProyectoDto } from '../dto/proyectos.dto';

@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Get()
  async findAll(@Query('nombre') nombre?: string) {
    if (nombre) {
      const proyecto = await this.proyectosService.findByNombre(nombre);
      return proyecto ? [proyecto] : [];
    }
    return this.proyectosService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const proyecto = await this.proyectosService.findOne(+id);
    if (!proyecto) {
      throw new HttpException('Proyecto no encontrado', HttpStatus.NOT_FOUND);
    }
    return proyecto;
  }

  @Post()
  async create(@Body() createProyectoDto: CreateProyectoDto) {
    try {
      const validatedData = CreateProyectoSchema.parse(createProyectoDto);
      return this.proyectosService.create(validatedData);
    } catch (error) {
      throw new HttpException(
        'Datos inválidos: ' + (error as any).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateProyectoDto: UpdateProyectoDto) {
    try {
      const validatedData = UpdateProyectoSchema.parse(updateProyectoDto);
      const proyecto = await this.proyectosService.update(+id, validatedData);
      if (!proyecto) {
        throw new HttpException('Proyecto no encontrado', HttpStatus.NOT_FOUND);
      }
      return proyecto;
    } catch (error) {
      throw new HttpException(
        'Datos inválidos: ' + (error as any).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const result = await this.proyectosService.remove(+id);
    if (!result) {
      throw new HttpException('Proyecto no encontrado', HttpStatus.NOT_FOUND);
    }
    return result;
  }
}