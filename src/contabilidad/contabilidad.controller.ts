import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContabilidadService } from './contabilidad.service';
import {
  ImportContabilidadDto,
  ImportContabilidadSchema,
} from './dto/import-asiento-contable.dto';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

@Controller('contabilidad')
export class ContabilidadController {
  constructor(private readonly contabilidadService: ContabilidadService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('q') q: string = '',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.contabilidadService.findAll(q, Number(page), Number(limit));
  }

  @Get('catalogos')
  @HttpCode(HttpStatus.OK)
  async getCatalogos() {
    return this.contabilidadService.getCatalogos();
  }

  @Post('import/preview')
  @HttpCode(HttpStatus.OK)
  async preview(
    @Body(new ZodValidationPipe(ImportContabilidadSchema))
    dto: ImportContabilidadDto,
  ) {
    return this.contabilidadService.preview(dto.filas);
  }

  @Post('import/confirm')
  @HttpCode(HttpStatus.CREATED)
  async confirm(
    @Body(new ZodValidationPipe(ImportContabilidadSchema))
    dto: ImportContabilidadDto,
    @Request() req: any,
  ) {
    const usuarioId = dto.usuarioId || req.user?.id || 1;
    return this.contabilidadService.confirmarImportacion(
      dto.filas,
      dto.nombreArchivo,
      usuarioId,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.contabilidadService.remove(+id);
    return {
      success: true,
      message: 'Asiento contable eliminado exitosamente',
    };
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  async restore(@Param('id') id: string) {
    await this.contabilidadService.restore(+id);
    return {
      success: true,
      message: 'Asiento contable restaurado exitosamente',
    };
  }
}
