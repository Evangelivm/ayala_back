import { Controller, Get, Param } from '@nestjs/common';
import { CentrosCostoService } from './centros-costo.service';

@Controller('centros-costo')
export class CentrosCostoController {
  constructor(private readonly centrosCostoService: CentrosCostoService) {}

  @Get('nivel1')
  getNivel1() {
    return this.centrosCostoService.getNivel1();
  }

  @Get('nivel2/:codigoPadre')
  getNivel2(@Param('codigoPadre') codigoPadre: string) {
    return this.centrosCostoService.getNivel2(codigoPadre);
  }

  @Get('nivel3/:codigoPadre')
  getNivel3(@Param('codigoPadre') codigoPadre: string) {
    return this.centrosCostoService.getNivel3(codigoPadre);
  }

  @Get('all')
  getAll() {
    return this.centrosCostoService.getAll();
  }

  @Get(':codigo')
  findByCodigo(@Param('codigo') codigo: string) {
    return this.centrosCostoService.findByCodigo(codigo);
  }
}
