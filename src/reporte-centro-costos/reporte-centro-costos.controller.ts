import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ReporteCentroCostosService } from './reporte-centro-costos.service';

@Controller('reporte-centro-costos')
export class ReporteCentroCostosController {
  constructor(
    private readonly reporteCentroCostosService: ReporteCentroCostosService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('q') q?: string,
    @Query('tipo_orden') tipoOrden?: 'compra' | 'servicio',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    try {
      const result = await this.reporteCentroCostosService.findAll({
        q,
        tipoOrden: tipoOrden === 'compra' || tipoOrden === 'servicio' ? tipoOrden : undefined,
        page: Math.max(1, parseInt(page, 10) || 1),
        limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
      });
      return result;
    } catch (error) {
      console.error('Error obteniendo reporte de centro de costos:', error);
      throw error;
    }
  }
}
