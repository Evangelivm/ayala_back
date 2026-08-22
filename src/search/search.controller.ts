import {
  Controller,
  Get,
  Post,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('programacion-tecnica')
  async searchProgramacionTecnica(
    @Query('q') q: string = '',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('programacion') programacion?: string,
    @Query('estadoProgramacion') estadoProgramacion?: string,
  ) {
    const { data, total } = await this.searchService.search(
      'programacion_tecnica',
      q,
      page,
      limit,
      {
        ...(programacion ? { programacion } : {}),
        ...(estadoProgramacion
          ? { estado_programacion: estadoProgramacion }
          : {}),
      },
    );
    return { data, total, page, limit };
  }

  @Get('ordenes-compra')
  async searchOrdenesCompra(
    @Query('q') q: string = '',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('estado') estado?: string,
    @Query('fecha') fecha?: string,
    @Query('placa') placa?: string,
    @Query('tipo') tipo?: string,
    @Query('chofer') chofer?: string,
    @Query('autoAdministrador') autoAdministrador?: string,
    @Query('autoContabilidad') autoContabilidad?: string,
    @Query('jefeProyecto') jefeProyecto?: string,
    @Query('procedePago') procedePago?: string,
  ) {
    const { data, total } = await this.searchService.search(
      'ordenes_compra',
      q,
      page,
      limit,
      this.buildFiltrosOrdenes({
        estado,
        fecha,
        placa,
        tipo,
        chofer,
        autoAdministrador,
        autoContabilidad,
        jefeProyecto,
        procedePago,
      }),
    );
    return { data, total, page, limit };
  }

  @Get('ordenes-servicio')
  async searchOrdenesServicio(
    @Query('q') q: string = '',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('estado') estado?: string,
    @Query('fecha') fecha?: string,
    @Query('placa') placa?: string,
    @Query('tipo') tipo?: string,
    @Query('chofer') chofer?: string,
    @Query('autoAdministrador') autoAdministrador?: string,
    @Query('autoContabilidad') autoContabilidad?: string,
    @Query('jefeProyecto') jefeProyecto?: string,
    @Query('procedePago') procedePago?: string,
  ) {
    const { data, total } = await this.searchService.search(
      'ordenes_servicio',
      q,
      page,
      limit,
      this.buildFiltrosOrdenes({
        estado,
        fecha,
        placa,
        tipo,
        chofer,
        autoAdministrador,
        autoContabilidad,
        jefeProyecto,
        procedePago,
      }),
    );
    return { data, total, page, limit };
  }

  @Post('reindex')
  async reindex() {
    const result = await this.searchService.reindexAll();
    return {
      message: 'Reindexado completado',
      counts: result,
    };
  }

  @Post('recreate-indices')
  async recreateIndices() {
    const result = await this.searchService.recreateIndices();
    return {
      message: 'Índices recreados y repoblados',
      counts: result,
    };
  }

  private buildFiltrosOrdenes(params: {
    estado?: string;
    fecha?: string;
    placa?: string;
    tipo?: string;
    chofer?: string;
    autoAdministrador?: string;
    autoContabilidad?: string;
    jefeProyecto?: string;
    procedePago?: string;
  }): Record<string, string | boolean> {
    const filtros: Record<string, string | boolean> = {};
    if (params.estado) filtros.estado = params.estado;
    if (params.fecha) filtros.fecha_registro = params.fecha;
    if (params.placa) filtros.placa_unidad = params.placa;
    if (params.tipo) filtros.tipo_unidad = params.tipo;
    if (params.chofer) filtros.chofer = params.chofer;
    if (params.autoAdministrador !== undefined) {
      filtros.auto_administrador = params.autoAdministrador === 'true';
    }
    if (params.autoContabilidad !== undefined) {
      filtros.auto_contabilidad = params.autoContabilidad === 'true';
    }
    if (params.jefeProyecto !== undefined) {
      filtros.jefe_proyecto = params.jefeProyecto === 'true';
    }
    if (params.procedePago) filtros.procede_pago = params.procedePago;
    return filtros;
  }
}
