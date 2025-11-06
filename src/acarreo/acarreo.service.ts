import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  type CreateAcarreoDto,
  type AcarreoItemDto,
  type AcarreoResponseDto,
} from '../dto/acarreo.dto';
import { Prisma } from '../../generated/prisma';
import { generarIdentificadorAleatorio } from '../utils/codigo-generator';

@Injectable()
export class AcarreoService {
  private readonly logger = new Logger(AcarreoService.name);

  constructor(private prisma: PrismaService) {}

  // Función helper para capitalizar cada palabra
  private capitalizeWords(text: string | null): string | null {
    if (!text) return null;
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async createBatch(
    createAcarreoDto: CreateAcarreoDto,
  ): Promise<AcarreoResponseDto> {
    const startTime = Date.now();
    const { data } = createAcarreoDto;

    if (!data || data.length === 0) {
      throw new BadRequestException('El array de datos no puede estar vacío');
    }

    this.logger.log(
      `Iniciando inserción masiva de ${data.length} registros de acarreo`,
    );

    try {
      // Preparar datos para inserción
      const acarreoData = data.map((item: AcarreoItemDto) => ({
        fecha: item.fecha instanceof Date ? item.fecha : new Date(item.fecha),
        unidad: item.unidad,
        proveedor: item.proveedor,
        programacion: item.programacion,
        hora_partida: new Date(`1970-01-01T${item.hora_partida}`),
        estado_programacion: item.estado_programacion || null,
        comentarios: item.comentarios || null,
        identificador_unico: generarIdentificadorAleatorio(), // Generar código único de 10 caracteres
        punto_partida_ubigeo: item.punto_partida_ubigeo,
        punto_partida_direccion: item.punto_partida_direccion,
        punto_llegada_ubigeo: item.punto_llegada_ubigeo,
        punto_llegada_direccion: item.punto_llegada_direccion,
        peso: item.peso || null,
        hora_registro: new Date(), // Registrar fecha y hora actual
      }));

      // Usar transacción con nivel de aislamiento SERIALIZABLE para máxima consistencia
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Log para debug
          this.logger.debug(
            `Insertando ${acarreoData.length} registros en transacción`,
          );

          // Inserción masiva en tabla programacion
          const insertResultAcarreo = await tx.programacion.createMany({
            data: acarreoData,
            skipDuplicates: false, // Fallar si hay duplicados para mantener integridad
          });

          this.logger.log(
            `Insertados ${insertResultAcarreo.count} registros en tabla programacion`,
          );

          // Preparar datos para programacion_tecnica (mapear peso a m3 e incluir id_proyecto y id_subproyecto)
          const acarreoTecnicaData = data.map((item: AcarreoItemDto, index: number) => ({
            fecha: acarreoData[index].fecha,
            unidad: acarreoData[index].unidad,
            proveedor: acarreoData[index].proveedor,
            programacion: acarreoData[index].programacion,
            hora_partida: acarreoData[index].hora_partida,
            estado_programacion: acarreoData[index].estado_programacion,
            comentarios: acarreoData[index].comentarios,
            identificador_unico: acarreoData[index].identificador_unico,
            m3: acarreoData[index].peso, // Mapear peso a m3 (ambos son Decimal)
            punto_llegada_direccion: acarreoData[index].punto_llegada_direccion,
            punto_llegada_ubigeo: acarreoData[index].punto_llegada_ubigeo,
            punto_partida_direccion: acarreoData[index].punto_partida_direccion,
            punto_partida_ubigeo: acarreoData[index].punto_partida_ubigeo,
            hora_registro: acarreoData[index].hora_registro, // Registrar la misma fecha y hora
            id_proyecto: item.id_proyecto || null, // Incluir id_proyecto si está presente
            id_subproyecto: item.id_subproyecto || null, // Incluir id_subproyecto si está presente
          }));

          // Inserción masiva en tabla programacion_tecnica
          const insertResultTecnica = await tx.programacion_tecnica.createMany({
            data: acarreoTecnicaData,
            skipDuplicates: false,
          });

          this.logger.log(
            `Insertados ${insertResultTecnica.count} registros en tabla programacion_tecnica`,
          );

          return {
            count: insertResultAcarreo.count,
            countTecnica: insertResultTecnica.count,
            data: acarreoData,
          };
        },
        {
          isolationLevel: 'Serializable',
          timeout: 30000, // 30 segundos timeout
        },
      );

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Inserción masiva completada en ${processingTime}ms: ${result.count} en programacion, ${result.countTecnica} en programacion_tecnica`,
      );

      return {
        message: 'Registros de acarreo guardados exitosamente en ambas tablas',
        totalRecords: data.length,
        successCount: result.count,
        successCountTecnica: result.countTecnica,
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
      this.logger.error('Error al obtener registros de acarreo:', error);
      throw new InternalServerErrorException('Error al obtener los registros');
    }
  }

  async findById(id: number) {
    try {
      const acarreo = await this.prisma.programacion.findUnique({
        where: { id },
      });

      if (!acarreo) {
        throw new BadRequestException(`Registro con ID ${id} no encontrado`);
      }

      return acarreo;
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

  async findAllAcarreoTecnica() {
    try {
      // Usar consulta raw SQL para hacer JOINs con camiones, empresas_2025, proyecto y subproyectos
      const acarreoTecnica = await this.prisma.$queryRaw<any[]>`
        SELECT
          pt.*,
          c.placa as unidad_placa,
          c.nombre_chofer,
          c.apellido_chofer,
          c.capacidad_tanque as camion_capacidad,
          e.razon_social as empresa_razon_social,
          gr.enlace_del_pdf,
          gr.enlace_del_xml,
          gr.enlace_del_cdr,
          p.nombre as nombre_proyecto,
          sp.nombre as nombre_subproyecto
        FROM programacion_tecnica pt
        LEFT JOIN camiones c ON pt.unidad = c.id_camion
        LEFT JOIN empresas_2025 e ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
        LEFT JOIN guia_remision gr ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci AND gr.estado_gre = 'COMPLETADO'
        LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
        LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
        ORDER BY pt.fecha DESC
      `;

      // Mapear los resultados al formato esperado por el frontend
      const data = acarreoTecnica.map(at => {
        // Capitalizar nombre y apellido por separado, luego concatenar
        const nombreCapitalizado = this.capitalizeWords(at.nombre_chofer);
        const apellidoCapitalizado = this.capitalizeWords(at.apellido_chofer);
        const nombreCompleto = nombreCapitalizado && apellidoCapitalizado
          ? `${nombreCapitalizado} ${apellidoCapitalizado}`
          : null;

        // Determinar el nombre del proyecto y su tipo
        let nombreProyecto: string | null = null;
        let tipoProyecto: 'proyecto' | 'subproyecto' | null = null;

        if (at.nombre_subproyecto) {
          nombreProyecto = at.nombre_subproyecto;
          tipoProyecto = 'subproyecto';
        } else if (at.nombre_proyecto) {
          nombreProyecto = at.nombre_proyecto;
          tipoProyecto = 'proyecto';
        }

        return {
          id: at.id,
          fecha: at.fecha,
          unidad: at.unidad_placa || null,
          proveedor: at.empresa_razon_social || null,
          apellidos_nombres: nombreCompleto,
          proyectos: nombreProyecto,
          tipo_proyecto: tipoProyecto,
          programacion: at.programacion,
          hora_partida: at.hora_partida,
          estado_programacion: at.estado_programacion,
          comentarios: at.comentarios,
          validacion: at.validacion,
          identificador_unico: at.identificador_unico,
          km_del_dia: at.km_del_dia,
          mes: at.mes,
          num_semana: at.num_semana,
          m3: at.m3 ? at.m3.toString() : null,
          cantidad_viaje: at.cantidad_viaje,
          enlace_del_pdf: at.enlace_del_pdf || null,
          enlace_del_xml: at.enlace_del_xml || null,
          enlace_del_cdr: at.enlace_del_cdr || null,
        };
      });

      return data;
    } catch (error) {
      this.logger.error('Error al obtener registros de acarreo técnica:', error);
      throw new InternalServerErrorException('Error al obtener los registros');
    }
  }
}
