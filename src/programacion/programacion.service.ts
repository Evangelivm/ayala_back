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
        proveedor: item.proveedor,
        apellidos_nombres: item.apellidos_nombres,
        proyectos: item.proyectos,
        programacion: item.programacion,
        hora_partida: new Date(`1970-01-01T${item.hora_partida}`),
        estado_programacion: item.estado_programacion || null,
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

  async findAll() {
    try {
      const data = await this.prisma.programacion.findMany({
        orderBy: {
          fecha: 'desc',
        },
      });

      return data;
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

  async findAllProgramacionTecnica() {
    try {
      // Obtener todos los registros de programación técnica
      const programacionTecnica = await this.prisma.programacion_tecnica.findMany({
        orderBy: {
          fecha: 'desc',
        },
      });

      // Obtener los identificadores únicos
      const identificadoresUnicos = programacionTecnica
        .map(pt => pt.identificador_unico)
        .filter((id): id is string => id !== null);

      // Obtener las guías de remisión completadas para esos identificadores
      const guiasRemision = await this.prisma.guia_remision.findMany({
        where: {
          identificador_unico: {
            in: identificadoresUnicos,
          },
          estado_gre: 'COMPLETADO',
        },
        select: {
          identificador_unico: true,
          enlace_del_pdf: true,
          enlace_del_xml: true,
          enlace_del_cdr: true,
        },
      });

      // Crear un mapa de guías por identificador único
      const guiasMap = new Map(
        guiasRemision.map(guia => [guia.identificador_unico, guia])
      );

      // Combinar los datos
      const data = programacionTecnica.map(pt => {
        const guia = pt.identificador_unico ? guiasMap.get(pt.identificador_unico) : null;
        return {
          ...pt,
          enlace_del_pdf: guia?.enlace_del_pdf || null,
          enlace_del_xml: guia?.enlace_del_xml || null,
          enlace_del_cdr: guia?.enlace_del_cdr || null,
        };
      });

      return data;
    } catch (error) {
      this.logger.error('Error al obtener registros de programación técnica:', error);
      throw new InternalServerErrorException('Error al obtener los registros');
    }
  }

  async getProgramacionTecnicaById(id: number) {
    try {
      const programacionTecnica =
        await this.prisma.programacion_tecnica.findUnique({
          where: { id },
          select: {
            id: true,
            identificador_unico: true,
            guia_numero_documento: true,
            guia_destinatario_denominacion: true,
            guia_destinatario_direccion: true,
            guia_traslado_peso_bruto: true,
            guia_traslado_vehiculo_placa: true,
            guia_conductor_dni_numero: true,
            guia_conductor_nombres: true,
            guia_conductor_apellidos: true,
            guia_conductor_num_licencia: true,
            guia_partida_ubigeo: true,
            guia_partida_direccion: true,
            guia_llegada_ubigeo: true,
            guia_llegada_direccion: true,
          },
        });

      if (!programacionTecnica) {
        throw new BadRequestException(
          `Programación técnica con ID ${id} no encontrada`,
        );
      }

      return programacionTecnica;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error al obtener programación técnica con ID ${id}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Error al obtener la programación técnica',
      );
    }
  }

  async updateProgramacionTecnica(
    id: number,
    updateData: {
      id_proyecto?: number;
      id_etapa?: number;
      id_sector?: number;
      id_frente?: number;
      id_partida?: number;
    },
  ) {
    try {
      // Verificar que el registro existe
      const existingRecord = await this.prisma.programacion_tecnica.findUnique({
        where: { id },
      });

      if (!existingRecord) {
        throw new BadRequestException(
          `Programación técnica con ID ${id} no encontrada`,
        );
      }

      // Actualizar el registro con los nuevos valores
      const updatedRecord = await this.prisma.programacion_tecnica.update({
        where: { id },
        data: {
          id_proyecto: updateData.id_proyecto ?? null,
          id_etapa: updateData.id_etapa ?? null,
          id_sector: updateData.id_sector ?? null,
          id_frente: updateData.id_frente ?? null,
          id_partida: updateData.id_partida ?? null,
        },
      });

      this.logger.log(
        `Programación técnica con ID ${id} actualizada exitosamente`,
      );

      return {
        message: 'Programación técnica actualizada exitosamente',
        data: updatedRecord,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new BadRequestException(
          `Programación técnica con ID ${id} no encontrada`,
        );
      }

      this.logger.error(
        `Error al actualizar programación técnica con ID ${id}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Error al actualizar la programación técnica',
      );
    }
  }

  async getIdentificadoresConGuia(): Promise<string[]> {
    try {
      // Obtener todos los identificadores únicos de guías de remisión
      const guias = await this.prisma.guia_remision.findMany({
        where: {
          identificador_unico: {
            not: null,
          },
        },
        select: {
          identificador_unico: true,
        },
        distinct: ['identificador_unico'],
      });

      // Filtrar nulos y retornar solo los identificadores
      const identificadores = guias
        .map(guia => guia.identificador_unico)
        .filter((id): id is string => id !== null);

      this.logger.log(`Encontrados ${identificadores.length} identificadores únicos con guía generada`);

      return identificadores;
    } catch (error) {
      this.logger.error('Error al obtener identificadores únicos con guía:', error);
      throw new InternalServerErrorException('Error al obtener los identificadores');
    }
  }
}
