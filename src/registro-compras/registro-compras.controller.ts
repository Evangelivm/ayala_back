import {
  Controller,
  Post,
  Get,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  UseInterceptors,
} from '@nestjs/common';
import { RegistroComprasService } from './registro-compras.service';
import { BackendLogsInterceptor } from '../common/interceptors/backend-logs.interceptor';
import {
  CreateMasivoSchema,
  type CreateMasivoDto,
  type MasivoResponseDto,
} from '../dto/registro-compras.dto';

@Controller('registro-compras')
@UseInterceptors(BackendLogsInterceptor)
export class RegistroComprasController {
  private readonly logger = new Logger(RegistroComprasController.name);

  constructor(
    private readonly registroComprasService: RegistroComprasService,
  ) {}

  @Post()
  async createBatch(
    @Body() createMasivoDto: CreateMasivoDto,
  ): Promise<MasivoResponseDto> {
    try {
      const validatedData = CreateMasivoSchema.parse(createMasivoDto);

      this.logger.log(
        `Recibida solicitud de inserción masiva con ${validatedData.data.length} líneas`,
      );

      return await this.registroComprasService.createBatch(validatedData);
    } catch (error: any) {
      if (error instanceof Error && 'issues' in error) {
        throw new HttpException(
          'Datos inválidos: ' + error.message,
          HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
  }

  @Get('ultimo-numero')
  async getUltimoRegistro() {
    return this.registroComprasService.getUltimoRegistro();
  }
}
