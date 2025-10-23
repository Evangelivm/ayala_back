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
} from '@nestjs/common';
import { ProgramacionService } from './programacion.service';
import {
  CreateProgramacionSchema,
  type CreateProgramacionDto,
  type ProgramacionResponseDto,
} from '../dto/programacion.dto';

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
}
