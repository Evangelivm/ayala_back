import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ProveedoresService } from './proveedores.service';

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
}
