import { Controller, Get, Post, Body, Param, Put, Delete, Query, HttpException, HttpStatus } from '@nestjs/common';
import { EmpresasService } from './empresas.service';
import { CreateEmpresaSchema, UpdateEmpresaSchema, type CreateEmpresaDto, type UpdateEmpresaDto } from '../dto/empresas.dto';

@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Get()
  async findAll(
    @Query('Raz_n_social') Raz_n_social?: string,
    @Query('N__documento') N__documento?: string,
    @Query('Tipo') Tipo?: string,
  ) {
    const filters = {
      Raz_n_social,
      N__documento,
      Tipo,
    };

    return this.empresasService.findAll(filters);
  }

  @Get(':codigo')
  async findOne(@Param('codigo') codigo: string) {
    const empresa = await this.empresasService.findOne(codigo);
    if (!empresa) {
      throw new HttpException('Empresa no encontrada', HttpStatus.NOT_FOUND);
    }
    return empresa;
  }

  @Post()
  async create(@Body() createEmpresaDto: CreateEmpresaDto) {
    try {
      const validatedData = CreateEmpresaSchema.parse(createEmpresaDto);
      return this.empresasService.create(validatedData);
    } catch (error) {
      throw new HttpException(
        'Datos inválidos: ' + (error as any).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':codigo')
  async update(@Param('codigo') codigo: string, @Body() updateEmpresaDto: UpdateEmpresaDto) {
    try {
      const validatedData = UpdateEmpresaSchema.parse(updateEmpresaDto);
      return this.empresasService.update(codigo, validatedData);
    } catch (error) {
      throw new HttpException(
        'Datos inválidos: ' + (error as any).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':codigo')
  async remove(@Param('codigo') codigo: string) {
    return this.empresasService.remove(codigo);
  }
}
