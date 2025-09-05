import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  type CreateProgramacionDto,
  type ProgramacionItemDto,
  type ProgramacionResponseDto,
} from '../dto/programacion.dto';
import { Prisma } from '../../generated/prisma';

@Injectable()
export class ProgramacionService {
  private readonly logger = new Logger(ProgramacionService.name);

  constructor(private prisma: PrismaService) {}

  async createBatch(
    createProgramacionDto: CreateProgramacionDto,
  ): Promise<ProgramacionResponseDto> {
    const startTime = Date.now();
    const { data } = createProgramacionDto;

    if (!data || data.length === 0) {
      throw new BadRequestException('El array de datos no puede estar vacío');
    }

    this.logger.log(
      `Iniciando inserción masiva de ${data.length} registros de programación`,
    );

    try {
      // Preparar datos para inserción
      const programacionData = data.map((item: ProgramacionItemDto) => ({
        fecha: item.fecha instanceof Date ? item.fecha : new Date(item.fecha),
        unidad: item.unidad,
        apellidos_nombres: item.apellidos_nombres,
        proyectos: item.proyectos,
        programacion: item.programacion,
        hora_partida: new Date(`1970-01-01T${item.hora_partida}`),
        estado_programacion: item.estado_programacion,
        comentarios: item.comentarios || null,
      }));

      // Usar transacción con nivel de aislamiento SERIALIZABLE para máxima consistencia
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Log para debug
          this.logger.debug(
            `Insertando ${programacionData.length} registros en transacción`,
          );

          // Inserción masiva optimizada con createMany
          const insertResult = await tx.programacion.createMany({
            data: programacionData,
            skipDuplicates: false, // Fallar si hay duplicados para mantener integridad
          });

          this.logger.log(
            `Insertados ${insertResult.count} registros exitosamente`,
          );

          return {
            count: insertResult.count,
            data: programacionData,
          };
        },
        {
          isolationLevel: 'Serializable',
          timeout: 30000, // 30 segundos timeout
        },
      );

      const processingTime = Date.now() - startTime;

      this.logger.log(`Inserción masiva completada en ${processingTime}ms`);

      return {
        message: 'Registros de programación guardados exitosamente',
        totalRecords: data.length,
        successCount: result.count,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Error en inserción masiva después de ${processingTime}ms:`,
        error,
      );

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2002':
            throw new BadRequestException(
              'Error de duplicado: Algunos registros ya existen en la base de datos',
            );
          case 'P2003':
            throw new BadRequestException(
              'Error de referencia: Algunos datos hacen referencia a registros que no existen',
            );
          case 'P2025':
            throw new BadRequestException(
              'Error de datos: Algunos registros no pudieron ser procesados',
            );
          default:
            throw new InternalServerErrorException(
              `Error de base de datos: ${error.message}`,
            );
        }
      }

      if (error instanceof Prisma.PrismaClientValidationError) {
        throw new BadRequestException(
          'Error de validación: Los datos proporcionados no cumplen con el formato requerido',
        );
      }

      throw new InternalServerErrorException(
        'Error interno del servidor durante la inserción masiva',
      );
    }
  }

  async findAll(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    try {
      const [data, total] = await Promise.all([
        this.prisma.programacion.findMany({
          skip,
          take: limit,
          orderBy: {
            fecha: 'desc',
          },
        }),
        this.prisma.programacion.count(),
      ]);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error al obtener registros de programación:', error);
      throw new InternalServerErrorException('Error al obtener los registros');
    }
  }

  async findById(id: number) {
    try {
      const programacion = await this.prisma.programacion.findUnique({
        where: { id },
      });

      if (!programacion) {
        throw new BadRequestException(`Registro con ID ${id} no encontrado`);
      }

      return programacion;
    } catch (error) {
      this.logger.error(`Error al obtener registro con ID ${id}:`, error);
      throw new InternalServerErrorException('Error al obtener el registro');
    }
  }

  async deleteById(id: number) {
    try {
      await this.prisma.programacion.delete({
        where: { id },
      });

      this.logger.log(`Registro con ID ${id} eliminado exitosamente`);

      return {
        message: 'Registro eliminado exitosamente',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new BadRequestException(`Registro con ID ${id} no encontrado`);
      }

      this.logger.error(`Error al eliminar registro con ID ${id}:`, error);
      throw new InternalServerErrorException('Error al eliminar el registro');
    }
  }
}
