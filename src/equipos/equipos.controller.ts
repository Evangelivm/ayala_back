import { Controller, Get, Post, Body, Param, Put, Delete, Query, HttpException, HttpStatus } from '@nestjs/common';
import { EquiposService } from './equipos.service';
import { CreateEquipoSchema, UpdateEquipoSchema, type CreateEquipoDto, type UpdateEquipoDto } from '../dto/equipos.dto';

@Controller('equipos')
export class EquiposController {
  constructor(private readonly equiposService: EquiposService) {}

  @Get()
  async findAll(@Query('tipo_equipo') tipo_equipo?: string) {
    if (tipo_equipo) {
      return this.equiposService.findByTipo(tipo_equipo);
    }
    return this.equiposService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const equipo = await this.equiposService.findOne(+id);
    if (!equipo) {
      throw new HttpException('Equipo no encontrado', HttpStatus.NOT_FOUND);
    }
    return equipo;
  }

  @Post()
  async create(@Body() createEquipoDto: CreateEquipoDto) {
    try {
      const validatedData = CreateEquipoSchema.parse(createEquipoDto);
      return this.equiposService.create(validatedData);
    } catch (error) {
      throw new HttpException(
        'Datos inválidos: ' + (error as any).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateEquipoDto: UpdateEquipoDto) {
    try {
      const validatedData = UpdateEquipoSchema.parse(updateEquipoDto);
      return this.equiposService.update(+id, validatedData);
    } catch (error) {
      throw new HttpException(
        'Datos inválidos: ' + (error as any).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.equiposService.remove(+id);
  }
}