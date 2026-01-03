import { Controller, Get, Post, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto, CreateProveedorSchema } from '../dto/proveedores.dto';

@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Get()
  async findAll() {
    return this.proveedoresService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const proveedor = await this.proveedoresService.findOne(+id);
    if (!proveedor) {
      throw new HttpException('Proveedor no encontrado', HttpStatus.NOT_FOUND);
    }
    return proveedor;
  }

  @Get('documento/:nro_documento')
  async findByDocumento(@Param('nro_documento') nro_documento: string) {
    const proveedor = await this.proveedoresService.findByDocumento(nro_documento);
    if (!proveedor) {
      throw new HttpException('Proveedor no encontrado', HttpStatus.NOT_FOUND);
    }
    return proveedor;
  }

  @Post()
  async create(@Body() createProveedorDto: CreateProveedorDto) {
    try {
      // Validar el DTO con Zod
      const validatedData = CreateProveedorSchema.parse(createProveedorDto);
      return await this.proveedoresService.create(validatedData);
    } catch (error) {
      if (error.name === 'ZodError') {
        throw new HttpException(
          {
            message: 'Datos de entrada inválidos',
            errors: error.errors,
          },
          HttpStatus.BAD_REQUEST
        );
      }
      throw error;
    }
  }
}
