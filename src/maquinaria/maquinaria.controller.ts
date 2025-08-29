import { Controller, Get, Post, Body, Param, Put, Delete, Query, HttpException, HttpStatus } from '@nestjs/common';
import { MaquinariaService } from './maquinaria.service';
import { CreateMaquinariaSchema, UpdateMaquinariaSchema, type CreateMaquinariaDto, type UpdateMaquinariaDto } from '../dto/maquinaria.dto';

@Controller('maquinaria')
export class MaquinariaController {
  constructor(private readonly maquinariaService: MaquinariaService) {}

  @Get()
  async findAll(@Query('nombre') nombre?: string) {
    if (nombre) {
      const maquinaria = await this.maquinariaService.findByNombre(nombre);
      return maquinaria ? [maquinaria] : [];
    }
    return this.maquinariaService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const maquinaria = await this.maquinariaService.findOne(+id);
    if (!maquinaria) {
      throw new HttpException('Maquinaria no encontrada', HttpStatus.NOT_FOUND);
    }
    return maquinaria;
  }

  @Post()
  async create(@Body() createMaquinariaDto: CreateMaquinariaDto) {
    try {
      const validatedData = CreateMaquinariaSchema.parse(createMaquinariaDto);
      return this.maquinariaService.create(validatedData);
    } catch (error) {
      throw new HttpException(
        'Datos inválidos: ' + (error as any).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateMaquinariaDto: UpdateMaquinariaDto) {
    try {
      const validatedData = UpdateMaquinariaSchema.parse(updateMaquinariaDto);
      return this.maquinariaService.update(+id, validatedData);
    } catch (error) {
      throw new HttpException(
        'Datos inválidos: ' + (error as any).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.maquinariaService.remove(+id);
  }
}