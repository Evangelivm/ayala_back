import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpException,
  HttpStatus,
  Logger,
  StreamableFile,
  Header,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ProgramacionService } from './programacion.service';
import { BackendLogsInterceptor } from '../common/interceptors/backend-logs.interceptor';
import {
  CreateProgramacionSchema,
  type CreateProgramacionDto,
  type ProgramacionResponseDto,
} from '../dto/programacion.dto';
import { PDFDocument } from 'pdf-lib';

@Controller('programacion')
@UseInterceptors(BackendLogsInterceptor)
export class ProgramacionController {
  private readonly logger = new Logger(ProgramacionController.name);

  constructor(private readonly programacionService: ProgramacionService) {}

  @Post()
  async createBatch(
    @Body() createProgramacionDto: CreateProgramacionDto,
  ): Promise<ProgramacionResponseDto> {
    try {
      // Validar datos con Zod
      const validatedData = CreateProgramacionSchema.parse(
        createProgramacionDto,
      );

      this.logger.log(
        `Recibida solicitud de inserción masiva con ${validatedData.data.length} registros`,
      );

      const result = await this.programacionService.createBatch(validatedData);

      this.logger.log(
        `Inserción masiva completada: ${result.successCount}/${result.totalRecords} registros en ${result.processingTime}ms`,
      );

      return result;
    } catch (error: any) {
      if (error instanceof Error && 'issues' in error) {
        // Error de validación de Zod
        throw new HttpException(
          'Datos inválidos: ' + error.message,
          HttpStatus.BAD_REQUEST,
        );
      }
      // Re-lanzar otros errores (del servicio)
      throw error;
    }
  }

  @Get()
  async findAll() {
    this.logger.log('Consultando todos los registros de programación');

    return await this.programacionService.findAll();
  }

  @Get('tecnica/admin')
  async findAllProgramacionTecnicaAdmin() {
    this.logger.log(
      'Consultando todos los registros de programación técnica (admin, incluye eliminados)',
    );
    return await this.programacionService.findAllProgramacionTecnicaAdmin();
  }

  @Get('tecnica/con-guia')
  async getIdentificadoresConGuia() {
    this.logger.log('Consultando identificadores únicos con guía generada');

    return await this.programacionService.getIdentificadoresConGuia();
  }

  @Get('tecnica/recien-completados')
  async getRecienCompletados(@Query('segundos') segundos?: string) {
    const segundosNum = segundos ? parseInt(segundos, 10) : 30;
    this.logger.log(
      `Consultando registros recién completados en los últimos ${segundosNum} segundos`,
    );

    return await this.programacionService.getRecienCompletados(segundosNum);
  }


  @Get('tecnica/:id')
  async getProgramacionTecnica(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Consultando programación técnica con ID: ${id}`);

    return await this.programacionService.getProgramacionTecnicaById(id);
  }

  @Get('tecnica')
  async findAllProgramacionTecnica() {
    this.logger.log('Consultando todos los registros de programación técnica');

    return await this.programacionService.findAllProgramacionTecnica();
  }

  @Patch('tecnica/:id')
  async updateProgramacionTecnica(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    updateData: {
      id_proyecto?: number;
      id_etapa?: number;
      id_sector?: number;
      id_frente?: number;
      id_partida?: number;
      id_subproyecto?: number;
      id_subetapa?: number;
      id_subsector?: number;
      id_subfrente?: number;
      id_subpartida?: number;
      m3?: string;
      estado_programacion?: string | null;
      comentarios?: string | null;
      cantidad_viaje?: string | null;
      proveedor?: string | null;
      fecha?: string | null;
      hora_partida?: string | null;
      unidad?: number | null;
      programacion?: string | null;
    },
  ) {
    this.logger.log(
      `Actualizando programación técnica con ID: ${id}. Datos:`,
      updateData,
    );

    return await this.programacionService.updateProgramacionTecnica(
      id,
      updateData,
    );
  }

  @Delete('tecnica/:id')
  async removeTecnica(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Soft delete de registro técnico con ID: ${id}`);
    return await this.programacionService.deleteTecnicaById(id);
  }

  @Patch('tecnica/:id/restore')
  async restoreTecnica(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Restaurando registro técnico con ID: ${id}`);
    return await this.programacionService.restoreTecnicaById(id);
  }

  @Patch('tecnica/:id/numero-orden')
  async updateNumeroOrden(
    @Param('id', ParseIntPipe) id: number,
    @Body('numero_orden') numeroOrden: string | null,
  ) {
    this.logger.log(`Actualizando numero_orden del registro técnico ID: ${id}`);
    return await this.programacionService.updateNumeroOrden(id, numeroOrden);
  }

  @Patch('tecnica/:id/backend-logs')
  async saveBackendLogs(
    @Param('id', ParseIntPipe) id: number,
    @Body('logs') logs: string,
  ) {
    await this.programacionService.saveBackendLogs(id, logs);
    return { success: true };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Consultando registro con ID: ${id}`);

    return await this.programacionService.findById(id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Eliminando registro con ID: ${id}`);

    return await this.programacionService.deleteById(id);
  }

  @Post('exportar-excel')
  async exportarExcel(
    @Body()
    body: {
      proveedores?: string[];
      unidades?: string[];
      fechaDesde?: string;
      fechaHasta?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const buffer = await this.programacionService.exportarExcel(body);
      const fecha = new Date().toISOString().split('T')[0];
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="programacion_${fecha}.xlsx"`,
      );
      res.send(buffer);
    } catch (error: any) {
      this.logger.error('Error exportando Excel:', error);
      throw new HttpException(
        'Error al generar el archivo Excel',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('exportar-excel-mixto')
  async exportarExcelMixto(
    @Body()
    body: { proveedores?: string[]; fechaDesde?: string; fechaHasta?: string },
    @Res() res: Response,
  ) {
    try {
      const buffer = await this.programacionService.exportarExcelMixto(body);
      const fecha = new Date().toISOString().split('T')[0];
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="programacion_mixta_${fecha}.xlsx"`,
      );
      res.send(buffer);
    } catch (error: any) {
      this.logger.error('Error exportando Excel mixto:', error);
      throw new HttpException(
        'Error al generar el archivo Excel mixto',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('combinar-pdfs')
  @Header('Content-Type', 'application/pdf')
  @Header(
    'Content-Disposition',
    'attachment; filename="programacion_combinado.pdf"',
  )
  async combinarPdfs(
    @Body() body: { urls: string[] },
  ): Promise<StreamableFile> {
    try {
      const { urls } = body;

      if (!urls || urls.length === 0) {
        throw new HttpException(
          'Se requiere al menos una URL de PDF',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Combinando ${urls.length} PDFs`);

      // Crear un nuevo documento PDF
      const mergedPdf = await PDFDocument.create();

      // Descargar y combinar cada PDF
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];

        try {
          this.logger.log(`Descargando PDF ${i + 1}/${urls.length}: ${url}`);

          // Descargar el PDF usando fetch nativo de Node.js 18+
          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(`Error al descargar PDF: ${response.statusText}`);
          }

          const pdfBytes = await response.arrayBuffer();

          // Cargar el PDF
          const pdf = await PDFDocument.load(pdfBytes);

          // Copiar todas las páginas del PDF al documento combinado
          const copiedPages = await mergedPdf.copyPages(
            pdf,
            pdf.getPageIndices(),
          );
          copiedPages.forEach((page) => {
            mergedPdf.addPage(page);
          });

          this.logger.log(`PDF ${i + 1}/${urls.length} procesado exitosamente`);
        } catch (error: any) {
          this.logger.error(`Error procesando PDF ${i + 1}: ${error.message}`);
          // Continuar con los demás PDFs
        }
      }

      // Guardar el PDF combinado
      const mergedPdfBytes = await mergedPdf.save();

      this.logger.log(
        `PDFs combinados exitosamente. Tamaño: ${mergedPdfBytes.byteLength} bytes`,
      );

      // Devolver el PDF como un archivo descargable
      return new StreamableFile(Buffer.from(mergedPdfBytes));
    } catch (error: any) {
      this.logger.error(`Error al combinar PDFs: ${error.message}`);
      throw new HttpException(
        'Error al combinar los PDFs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
