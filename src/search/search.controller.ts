import { Controller, Get, Post, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('programacion-tecnica')
  async searchProgramacionTecnica(
    @Query('q') q: string = '',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const { data, total } = await this.searchService.search(
      'programacion_tecnica',
      q,
      page,
      limit,
    );
    return { data, total, page, limit };
  }

  @Get('ordenes-compra')
  async searchOrdenesCompra(
    @Query('q') q: string = '',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const { data, total } = await this.searchService.search(
      'ordenes_compra',
      q,
      page,
      limit,
    );
    return { data, total, page, limit };
  }

  @Get('ordenes-servicio')
  async searchOrdenesServicio(
    @Query('q') q: string = '',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const { data, total } = await this.searchService.search(
      'ordenes_servicio',
      q,
      page,
      limit,
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
}
