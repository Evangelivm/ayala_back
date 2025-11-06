import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AcarreoService } from './acarreo.service';
import {
  CreateAcarreoSchema,
  type CreateAcarreoDto,
  type AcarreoResponseDto,
} from '../dto/acarreo.dto';

@Controller('acarreo')
export class AcarreoController {
  private readonly logger = new Logger(AcarreoController.name);

  constructor(private readonly acarreoService: AcarreoService) {}

  @Post()
  async createBatch(
    @Body() createAcarreoDto: CreateAcarreoDto,
  ): Promise<AcarreoResponseDto> {
    try {
      // Validar datos con Zod
      const validatedData = CreateAcarreoSchema.parse(
        createAcarreoDto,
      );

      this.logger.log(
        `Recibida solicitud de inserción masiva con ${validatedData.data.length} registros`,
      );

      const result = await this.acarreoService.createBatch(validatedData);

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
    this.logger.log('Consultando todos los registros de acarreo');

    return await this.acarreoService.findAll();
  }

  @Get('tecnica')
  async findAllAcarreoTecnica() {
    this.logger.log('Consultando todos los registros de acarreo técnica');

    return await this.acarreoService.findAllAcarreoTecnica();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Consultando registro con ID: ${id}`);

    return await this.acarreoService.findById(id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Eliminando registro con ID: ${id}`);

    return await this.acarreoService.deleteById(id);
  }
}
