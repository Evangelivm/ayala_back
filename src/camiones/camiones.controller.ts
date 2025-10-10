import { Controller, Get, Post, Body, Param, Put, Delete, Query, HttpException, HttpStatus } from '@nestjs/common';
import { CamionesService } from './camiones.service';
import { CreateCamionSchema, UpdateCamionSchema, type CreateCamionDto, type UpdateCamionDto } from '../dto/camiones.dto';

@Controller('camiones')
export class CamionesController {
  constructor(private readonly camionesService: CamionesService) {}

  @Get()
  async findAll(
    @Query('placa') placa?: string,
    @Query('marca') marca?: string,
    @Query('modelo') modelo?: string,
    @Query('dni') dni?: string,
    @Query('nombre_chofer') nombre_chofer?: string,
    @Query('activo') activo?: string,
  ) {
    const filters = {
      placa,
      marca,
      modelo,
      dni,
      nombre_chofer,
      activo: activo !== undefined ? activo === 'true' : undefined,
    };

    return this.camionesService.findAll(filters);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const camion = await this.camionesService.findOne(+id);
    if (!camion) {
      throw new HttpException('Camión no encontrado', HttpStatus.NOT_FOUND);
    }
    return camion;
  }

  @Post()
  async create(@Body() createCamionDto: CreateCamionDto) {
    try {
      const validatedData = CreateCamionSchema.parse(createCamionDto);
      return this.camionesService.create(validatedData);
    } catch (error) {
      throw new HttpException(
        'Datos inválidos: ' + (error as any).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateCamionDto: UpdateCamionDto) {
    try {
      const validatedData = UpdateCamionSchema.parse(updateCamionDto);
      return this.camionesService.update(+id, validatedData);
    } catch (error) {
      throw new HttpException(
        'Datos inválidos: ' + (error as any).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.camionesService.remove(+id);
  }

  @Delete(':id/hard')
  async hardDelete(@Param('id') id: string) {
    return this.camionesService.hardDelete(+id);
  }
}
