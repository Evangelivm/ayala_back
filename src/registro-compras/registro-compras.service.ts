import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaThirdService } from '../prisma/prisma-third.service';
import {
  type CreateMasivoDto,
  type MasivoRowDto,
  type MasivoResponseDto,
} from '../dto/registro-compras.dto';

@Injectable()
export class RegistroComprasService {
  private readonly logger = new Logger(RegistroComprasService.name);

  constructor(private readonly prismaThird: PrismaThirdService) {}

  async createBatch(
    createMasivoDto: CreateMasivoDto,
  ): Promise<MasivoResponseDto> {
    const startTime = Date.now();
    const { data } = createMasivoDto;

    if (!data || data.length === 0) {
      throw new BadRequestException('El array de datos no puede estar vacío');
    }

    this.logger.log(
      `Iniciando inserción masiva de ${data.length} líneas de asiento (registro de compras)`,
    );

    try {
      const rows = data.map((item: MasivoRowDto) => ({
        campo: item.campo,
        sub_diario: item.sub_diario,
        num_comprobante: item.num_comprobante,
        fecha_documento: item.fecha_documento,
        fecha_vencimiento: item.fecha_vencimiento,
        tipo_documento: item.tipo_documento || null,
        numero_documento: item.numero_documento || null,
        codigo_anexo: item.codigo_anexo || null,
        glosa_principal: item.glosa_principal || null,
        importe_original: item.importe_original,
        debe_haber: item.debe_haber,
        cod_moneda: item.cod_moneda,
        tasa_igv: item.tasa_igv || null,
        cuenta_contable: item.cuenta_contable,
        codigo_auxiliar: item.codigo_auxiliar || null,
        tipo_doc_referencia: item.tipo_doc_referencia || null,
        num_doc_referencia: item.num_doc_referencia || null,
        fecha_doc_referencia: item.fecha_doc_referencia || null,
        tipo_conversion: item.tipo_conversion || null,
        flag_conversion: item.flag_conversion || null,
      }));

      const { successCount, first_reg, last_reg } =
        await this.prismaThird.$transaction(async (tx) => {
          const insertResult = await tx.masivo.createMany({ data: rows });

          const lastIdResult = await tx.masivo.aggregate({
            _max: { id: true },
          });
          const lastId = lastIdResult._max.id ?? null;
          const firstId =
            lastId !== null ? lastId - insertResult.count + 1 : null;

          return {
            successCount: insertResult.count,
            first_reg: firstId,
            last_reg: lastId,
          };
        });

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Inserción masiva completada: ${successCount}/${data.length} líneas en ${processingTime}ms`,
      );

      return {
        message: 'Asientos insertados exitosamente',
        totalRecords: data.length,
        successCount,
        processingTime,
        first_reg,
        last_reg,
      };
    } catch (error) {
      this.logger.error('Error al insertar asientos:', error);
      throw new InternalServerErrorException(
        'Error al insertar los asientos en la base de datos',
      );
    }
  }

  async getUltimoRegistro(): Promise<{ nextId: number }> {
    const result = await this.prismaThird.masivo.aggregate({
      _max: { id: true },
    });
    return { nextId: result._max.id ?? 0 };
  }
}
