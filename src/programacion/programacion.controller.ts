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
} from '@nestjs/common';
import { ProgramacionService } from './programacion.service';
import {
  CreateProgramacionSchema,
  type CreateProgramacionDto,
  type ProgramacionResponseDto,
} from '../dto/programacion.dto';
import { PDFDocument } from 'pdf-lib';

@Controller('programacion')
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
    } catch (error) {
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

  @Get('tecnica/con-guia')
  async getIdentificadoresConGuia() {
    this.logger.log('Consultando identificadores únicos con guía generada');

    return await this.programacionService.getIdentificadoresConGuia();
  }

  @Get('tecnica/recien-completados')
  async getRecienCompletados(@Query('segundos') segundos?: string) {
    const segundosNum = segundos ? parseInt(segundos, 10) : 30;
    this.logger.log(`Consultando registros recién completados en los últimos ${segundosNum} segundos`);

    return await this.programacionService.getRecienCompletados(segundosNum);
  }

  // ========== PROGRAMACIÓN EXTENDIDA - DUPLICACIÓN MASIVA ==========

  @Get('tecnica/originales')
  async getGuiasOriginales() {
    this.logger.log('Consultando guías originales (no duplicadas)');
    return await this.programacionService.getGuiasOriginales();
  }

  @Get('tecnica/duplicadas')
  async getGuiasDuplicadas() {
    this.logger.log('Consultando guías duplicadas');
    return await this.programacionService.getGuiasDuplicadas();
  }

  @Post('tecnica/duplicar')
  async duplicarGuia(
    @Body() body: {
      idGuiaOriginal: number;
      cantidad: number;
      modificaciones?: Array<Partial<any>>;
    },
  ) {
    const { idGuiaOriginal, cantidad, modificaciones } = body;

    this.logger.log(
      `Duplicando guía ${idGuiaOriginal} ${cantidad} veces`,
    );

    return await this.programacionService.duplicarGuia(
      idGuiaOriginal,
      cantidad,
      modificaciones,
    );
  }

  @Patch('tecnica/duplicados/actualizar')
  async actualizarDuplicados(
    @Body() body: {
      loteId: string;
      modificaciones: {
        peso_bruto_total?: number;
        id_proyecto?: number;
        id_subproyecto?: number;
        id_etapa?: number;
        id_sector?: number;
        id_frente?: number;
        id_partida?: number;
        id_subetapa?: number;
        id_subsector?: number;
        id_subfrente?: number;
        id_subpartida?: number;
      };
    },
  ) {
    const { loteId, modificaciones } = body;

    this.logger.log(
      `Actualizando duplicados del lote ${loteId} con modificaciones`,
    );

    return await this.programacionService.actualizarDuplicadosLote(
      loteId,
      modificaciones,
    );
  }

  @Post('tecnica/enviar-kafka')
  async enviarDuplicadosKafka(
    @Body() body: { loteId: string; idsGuias: number[] },
  ) {
    const { loteId, idsGuias } = body;

    this.logger.log(
      `Enviando ${idsGuias.length} duplicados del lote ${loteId} a Kafka`,
    );

    return await this.programacionService.enviarDuplicadosKafka(
      loteId,
      idsGuias,
    );
  }

  @Delete('tecnica/duplicados/:loteId')
  async eliminarDuplicados(@Param('loteId') loteId: string) {
    this.logger.log(`Eliminando duplicados del lote ${loteId}`);

    return await this.programacionService.eliminarDuplicados(loteId);
  }

  // ========== FIN PROGRAMACIÓN EXTENDIDA ==========

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
    @Body() updateData: {
      id_proyecto?: number;
      id_etapa?: number;
      id_sector?: number;
      id_frente?: number;
      id_partida?: number;
      m3?: string;
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

  @Post('combinar-pdfs')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="programacion_combinado.pdf"')
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
        } catch (error) {
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
    } catch (error) {
      this.logger.error(`Error al combinar PDFs: ${error.message}`);
      throw new HttpException(
        'Error al combinar los PDFs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
