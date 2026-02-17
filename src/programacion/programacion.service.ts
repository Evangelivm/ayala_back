import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  type CreateProgramacionDto,
  type ProgramacionItemDto,
  type ProgramacionResponseDto,
} from '../dto/programacion.dto';
import { Prisma } from '@generated/prisma';
import { generarIdentificadorAleatorio } from '../utils/codigo-generator';
import { GreExtendidoProducerService } from '../gre/services/gre-extendido-producer.service';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

// Configurar plugins de dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class ProgramacionService {
  private readonly logger = new Logger(ProgramacionService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => GreExtendidoProducerService))
    private readonly greExtendidoProducer?: GreExtendidoProducerService,
  ) {}

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
            `Insertando ${programacionData.length} registros en transacción`,
          );

          // Inserción masiva en tabla programacion
          const insertResultProgramacion = await tx.programacion.createMany({
            data: programacionData,
            skipDuplicates: false, // Fallar si hay duplicados para mantener integridad
          });

          this.logger.log(
            `Insertados ${insertResultProgramacion.count} registros en tabla programacion`,
          );

          // Preparar datos para programacion_tecnica (mapear peso a m3 e incluir id_proyecto y id_subproyecto)
          const programacionTecnicaData = data.map((item: ProgramacionItemDto, index: number) => ({
            fecha: programacionData[index].fecha,
            unidad: programacionData[index].unidad,
            proveedor: programacionData[index].proveedor,
            programacion: programacionData[index].programacion,
            hora_partida: programacionData[index].hora_partida,
            estado_programacion: programacionData[index].estado_programacion,
            comentarios: programacionData[index].comentarios,
            identificador_unico: programacionData[index].identificador_unico,
            m3: programacionData[index].peso, // Mapear peso a m3 (ambos son Decimal)
            punto_llegada_direccion: programacionData[index].punto_llegada_direccion,
            punto_llegada_ubigeo: programacionData[index].punto_llegada_ubigeo,
            punto_partida_direccion: programacionData[index].punto_partida_direccion,
            punto_partida_ubigeo: programacionData[index].punto_partida_ubigeo,
            hora_registro: programacionData[index].hora_registro, // Registrar la misma fecha y hora
            id_proyecto: item.id_proyecto || null, // Incluir id_proyecto si está presente
            id_subproyecto: item.id_subproyecto || null, // Incluir id_subproyecto si está presente
          }));

          // Inserción masiva en tabla programacion_tecnica
          const insertResultTecnica = await tx.programacion_tecnica.createMany({
            data: programacionTecnicaData,
            skipDuplicates: false,
          });

          this.logger.log(
            `Insertados ${insertResultTecnica.count} registros en tabla programacion_tecnica`,
          );

          return {
            count: insertResultProgramacion.count,
            countTecnica: insertResultTecnica.count,
            data: programacionData,
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
        message: 'Registros de programación guardados exitosamente en ambas tablas',
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

  async deleteTecnicaById(id: number) {
    try {
      // Obtener el registro para conseguir el identificador_unico
      const tecnica = await this.prisma.programacion_tecnica.findUnique({
        where: { id },
        select: { id: true, identificador_unico: true },
      });

      if (!tecnica) {
        throw new BadRequestException(`Registro técnico con ID ${id} no encontrado`);
      }

      // Eliminar de programacion_tecnica
      await this.prisma.programacion_tecnica.delete({ where: { id } });
      this.logger.log(`Registro programacion_tecnica ID ${id} eliminado`);

      // Eliminar de programacion por identificador_unico si existe
      if (tecnica.identificador_unico) {
        const deleted = await this.prisma.programacion.deleteMany({
          where: { identificador_unico: tecnica.identificador_unico },
        });
        this.logger.log(
          `Eliminados ${deleted.count} registros de programacion con identificador_unico=${tecnica.identificador_unico}`,
        );
      }

      return { message: 'Registro eliminado exitosamente de ambas tablas' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Error al eliminar registro técnico ID ${id}:`, error);
      throw new InternalServerErrorException('Error al eliminar el registro');
    }
  }

  async findAllProgramacionTecnica() {
    try {
      // Usar consulta raw SQL para hacer JOINs con camiones, empresas_2025, proyecto y subproyectos
      const programacionTecnica = await this.prisma.$queryRaw<any[]>`
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
      const data = programacionTecnica.map(pt => {
        // Capitalizar nombre y apellido por separado, luego concatenar
        const nombreCapitalizado = this.capitalizeWords(pt.nombre_chofer);
        const apellidoCapitalizado = this.capitalizeWords(pt.apellido_chofer);
        const nombreCompleto = nombreCapitalizado && apellidoCapitalizado
          ? `${nombreCapitalizado} ${apellidoCapitalizado}`
          : null;

        // Determinar el nombre del proyecto y su tipo
        let nombreProyecto: string | null = null;
        let tipoProyecto: 'proyecto' | 'subproyecto' | null = null;

        if (pt.nombre_subproyecto) {
          nombreProyecto = pt.nombre_subproyecto;
          tipoProyecto = 'subproyecto';
        } else if (pt.nombre_proyecto) {
          nombreProyecto = pt.nombre_proyecto;
          tipoProyecto = 'proyecto';
        }

        // Combinar fecha + hora_partida en un datetime completo interpretando la hora como hora de Perú
        let horaPartidaISO: string | null = null;
        if (pt.fecha && pt.hora_partida) {
          try {
            // Parsear fecha y hora por separado
            const fechaStr = dayjs(pt.fecha).format('YYYY-MM-DD');
            const horaStr = dayjs(pt.hora_partida).format('HH:mm:ss');

            // Combinar en formato ISO, interpretando la hora como hora de Perú (America/Lima)
            horaPartidaISO = dayjs.tz(`${fechaStr} ${horaStr}`, 'YYYY-MM-DD HH:mm:ss', 'America/Lima').toISOString();
          } catch (error) {
            this.logger.warn(`Error al combinar fecha y hora para registro ${pt.id}:`, error);
            horaPartidaISO = pt.hora_partida;
          }
        }

        return {
          id: pt.id,
          fecha: pt.fecha,
          unidad: pt.unidad_placa || null,
          proveedor: pt.empresa_razon_social || null,
          apellidos_nombres: nombreCompleto,
          proyectos: nombreProyecto,
          tipo_proyecto: tipoProyecto,
          programacion: pt.programacion,
          hora_partida: horaPartidaISO,
          estado_programacion: pt.estado_programacion,
          comentarios: pt.comentarios,
          validacion: pt.validacion,
          identificador_unico: pt.identificador_unico,
          km_del_dia: pt.km_del_dia,
          mes: pt.mes,
          num_semana: pt.num_semana,
          m3: pt.m3 ? pt.m3.toString() : null,
          cantidad_viaje: pt.cantidad_viaje,
          enlace_del_pdf: pt.enlace_del_pdf || null,
          enlace_del_xml: pt.enlace_del_xml || null,
          enlace_del_cdr: pt.enlace_del_cdr || null,
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
      // Usar consulta raw SQL para hacer JOINs con camiones, empresas_2025 y guia_remision
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT
          pt.*,
          c.placa as camion_placa,
          c.dni as camion_dni,
          c.nombre_chofer as camion_nombre_chofer,
          c.apellido_chofer as camion_apellido_chofer,
          c.numero_licencia as camion_numero_licencia,
          e.razon_social as empresa_razon_social,
          e.nro_documento as empresa_nro_documento,
          e.direccion as empresa_direccion,
          gr.enlace_del_pdf,
          gr.enlace_del_xml,
          gr.enlace_del_cdr
        FROM programacion_tecnica pt
        LEFT JOIN camiones c ON pt.unidad = c.id_camion
        LEFT JOIN empresas_2025 e ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
        LEFT JOIN guia_remision gr ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
        WHERE pt.id = ${id}
        LIMIT 1
      `;

      if (!result || result.length === 0) {
        throw new BadRequestException(
          `Programación técnica con ID ${id} no encontrada`,
        );
      }

      const programacionTecnica = result[0];

      // Construir el objeto de respuesta
      return {
        id: programacionTecnica.id,
        identificador_unico: programacionTecnica.identificador_unico,
        guia_numero_documento: programacionTecnica.guia_numero_documento,
        guia_destinatario_denominacion: programacionTecnica.guia_destinatario_denominacion,
        guia_destinatario_direccion: programacionTecnica.guia_destinatario_direccion,
        guia_traslado_peso_bruto: programacionTecnica.guia_traslado_peso_bruto,
        guia_traslado_vehiculo_placa: programacionTecnica.guia_traslado_vehiculo_placa,
        guia_conductor_dni_numero: programacionTecnica.guia_conductor_dni_numero,
        guia_conductor_nombres: programacionTecnica.guia_conductor_nombres,
        guia_conductor_apellidos: programacionTecnica.guia_conductor_apellidos,
        guia_conductor_num_licencia: programacionTecnica.guia_conductor_num_licencia,
        punto_partida_ubigeo: programacionTecnica.punto_partida_ubigeo,
        punto_partida_direccion: programacionTecnica.punto_partida_direccion,
        punto_llegada_ubigeo: programacionTecnica.punto_llegada_ubigeo,
        punto_llegada_direccion: programacionTecnica.punto_llegada_direccion,
        // Datos de la unidad (camión)
        camion_placa: programacionTecnica.camion_placa || null,
        camion_dni: programacionTecnica.camion_dni || null,
        camion_nombre_chofer: programacionTecnica.camion_nombre_chofer || null,
        camion_apellido_chofer: programacionTecnica.camion_apellido_chofer || null,
        camion_numero_licencia: programacionTecnica.camion_numero_licencia || null,
        // Datos del proveedor (empresa)
        empresa_razon_social: programacionTecnica.empresa_razon_social || null,
        empresa_nro_documento: programacionTecnica.empresa_nro_documento || null,
        empresa_direccion: programacionTecnica.empresa_direccion || null,
        // Datos del proyecto/subproyecto
        id_proyecto: programacionTecnica.id_proyecto || null,
        id_subproyecto: programacionTecnica.id_subproyecto || null,
        // Enlaces de la guía de remisión (desde Kafka/NUBEFACT)
        enlace_del_pdf: programacionTecnica.enlace_del_pdf || null,
        enlace_del_xml: programacionTecnica.enlace_del_xml || null,
        enlace_del_cdr: programacionTecnica.enlace_del_cdr || null,
      };
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
      id_subproyecto?: number;
      id_subetapa?: number;
      id_subsector?: number;
      id_subfrente?: number;
      id_subpartida?: number;
      m3?: string;
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
          id_subproyecto: updateData.id_subproyecto ?? null,
          id_subetapa: updateData.id_subetapa ?? null,
          id_subsector: updateData.id_subsector ?? null,
          id_subfrente: updateData.id_subfrente ?? null,
          id_subpartida: updateData.id_subpartida ?? null,
          m3: updateData.m3 ?? null,
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

  async getRecienCompletados(segundos: number = 30) {
    try {
      const tiempoLimite = new Date(Date.now() - segundos * 1000);

      // Usar consulta raw SQL para obtener registros recién completados con JOINs
      const datosCompletos = await this.prisma.$queryRaw<any[]>`
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
        INNER JOIN guia_remision gr ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
        LEFT JOIN camiones c ON pt.unidad = c.id_camion
        LEFT JOIN empresas_2025 e ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
        LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
        LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
        WHERE gr.estado_gre = 'COMPLETADO'
          AND gr.updated_at >= ${tiempoLimite}
          AND gr.enlace_del_pdf IS NOT NULL
          AND gr.enlace_del_xml IS NOT NULL
          AND gr.enlace_del_cdr IS NOT NULL
          AND gr.identificador_unico IS NOT NULL
        ORDER BY gr.updated_at DESC
      `;

      // Mapear los resultados al formato esperado por el frontend
      const data = datosCompletos.map(pt => {
        // Capitalizar nombre y apellido por separado, luego concatenar
        const nombreCapitalizado = this.capitalizeWords(pt.nombre_chofer);
        const apellidoCapitalizado = this.capitalizeWords(pt.apellido_chofer);
        const nombreCompleto = nombreCapitalizado && apellidoCapitalizado
          ? `${nombreCapitalizado} ${apellidoCapitalizado}`
          : null;

        // Determinar el nombre del proyecto y su tipo
        let nombreProyecto: string | null = null;
        let tipoProyecto: 'proyecto' | 'subproyecto' | null = null;

        if (pt.nombre_subproyecto) {
          nombreProyecto = pt.nombre_subproyecto;
          tipoProyecto = 'subproyecto';
        } else if (pt.nombre_proyecto) {
          nombreProyecto = pt.nombre_proyecto;
          tipoProyecto = 'proyecto';
        }

        // Combinar fecha + hora_partida en un datetime completo interpretando la hora como hora de Perú
        let horaPartidaISO: string | null = null;
        if (pt.fecha && pt.hora_partida) {
          try {
            // Parsear fecha y hora por separado
            const fechaStr = dayjs(pt.fecha).format('YYYY-MM-DD');
            const horaStr = dayjs(pt.hora_partida).format('HH:mm:ss');

            // Combinar en formato ISO, interpretando la hora como hora de Perú (America/Lima)
            horaPartidaISO = dayjs.tz(`${fechaStr} ${horaStr}`, 'YYYY-MM-DD HH:mm:ss', 'America/Lima').toISOString();
          } catch (error) {
            this.logger.warn(`Error al combinar fecha y hora para registro ${pt.id}:`, error);
            horaPartidaISO = pt.hora_partida;
          }
        }

        return {
          id: pt.id,
          fecha: pt.fecha,
          unidad: pt.unidad_placa || null,
          proveedor: pt.empresa_razon_social || null,
          apellidos_nombres: nombreCompleto,
          proyectos: nombreProyecto,
          tipo_proyecto: tipoProyecto,
          programacion: pt.programacion,
          hora_partida: horaPartidaISO,
          estado_programacion: pt.estado_programacion,
          comentarios: pt.comentarios,
          validacion: pt.validacion,
          identificador_unico: pt.identificador_unico,
          km_del_dia: pt.km_del_dia,
          mes: pt.mes,
          num_semana: pt.num_semana,
          m3: pt.m3 ? pt.m3.toString() : null,
          cantidad_viaje: pt.cantidad_viaje,
          enlace_del_pdf: pt.enlace_del_pdf || null,
          enlace_del_xml: pt.enlace_del_xml || null,
          enlace_del_cdr: pt.enlace_del_cdr || null,
        };
      });

      this.logger.log(`Encontrados ${data.length} registros recién completados en los últimos ${segundos} segundos`);

      return data;
    } catch (error) {
      this.logger.error('Error al obtener registros recién completados:', error);
      throw new InternalServerErrorException('Error al obtener los registros recién completados');
    }
  }

  // ========== PROGRAMACIÓN EXTENDIDA - DUPLICACIÓN MASIVA ==========

  async getGuiasOriginales() {
    try {
      // Consultar guías originales sin duplicados
      // Los colores y enlaces se basan en guia_remision_extendido
      // Se excluyen las guías que ya tienen enlaces en guia_remision o guia_remision_extendido
      const programacionTecnica = await this.prisma.$queryRaw<any[]>`
        SELECT
          pt.id,
          pt.fecha,
          pt.unidad,
          pt.proveedor,
          pt.programacion,
          pt.hora_partida,
          pt.estado_programacion,
          pt.comentarios,
          pt.validacion,
          pt.identificador_unico,
          pt.km_del_dia,
          pt.mes,
          pt.num_semana,
          pt.m3,
          pt.cantidad_viaje,
          pt.id_proyecto,
          pt.id_subproyecto,
          MAX(c.placa) as unidad_placa,
          MAX(c.nombre_chofer) as nombre_chofer,
          MAX(c.apellido_chofer) as apellido_chofer,
          MAX(e.razon_social) as empresa_razon_social,
          MAX(gre.enlace_del_pdf) as enlace_del_pdf,
          MAX(gre.enlace_del_xml) as enlace_del_xml,
          MAX(gre.enlace_del_cdr) as enlace_del_cdr,
          MAX(gre.estado_gre) as estado_gre,
          MAX(gre.duplicado_origen_id) as duplicado_origen_id,
          MAX(gre.duplicado_fecha) as duplicado_fecha,
          MAX(gre.duplicado_lote_id) as duplicado_lote_id,
          MAX(p.nombre) as nombre_proyecto,
          MAX(sp.nombre) as nombre_subproyecto
        FROM programacion_tecnica pt
        LEFT JOIN camiones c ON pt.unidad = c.id_camion
        LEFT JOIN empresas_2025 e ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
        LEFT JOIN guia_remision_extendido gre ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gre.identificador_unico COLLATE utf8mb4_unicode_ci
          AND (gre.duplicado_origen_id IS NULL OR gre.duplicado_origen_id = 0)
        LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
        LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
        WHERE pt.identificador_unico IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM guia_remision gr2
            WHERE gr2.identificador_unico COLLATE utf8mb4_unicode_ci = pt.identificador_unico COLLATE utf8mb4_unicode_ci
              AND (gr2.enlace_del_pdf IS NOT NULL OR gr2.enlace_del_xml IS NOT NULL OR gr2.enlace_del_cdr IS NOT NULL)
          )
          AND NOT EXISTS (
            SELECT 1 FROM guia_remision_extendido gre2
            WHERE gre2.identificador_unico COLLATE utf8mb4_unicode_ci = pt.identificador_unico COLLATE utf8mb4_unicode_ci
              AND (gre2.enlace_del_pdf IS NOT NULL OR gre2.enlace_del_xml IS NOT NULL OR gre2.enlace_del_cdr IS NOT NULL)
          )
        GROUP BY pt.id
        ORDER BY pt.fecha DESC, pt.id DESC
      `;

      // Mapear resultados al formato esperado
      const data = programacionTecnica.map(pt => this.mapProgramacionTecnicaData(pt));

      this.logger.log(`Encontradas ${data.length} guías originales`);
      return data;
    } catch (error) {
      this.logger.error('Error al obtener guías originales:', error);
      throw new InternalServerErrorException('Error al obtener guías originales');
    }
  }

  async getGuiasDuplicadas() {
    try {
      // Consultar guías duplicadas (duplicado_origen_id IS NOT NULL)
      const programacionTecnica = await this.prisma.$queryRaw<any[]>`
        SELECT
          pt.*,
          c.placa as unidad_placa,
          c.nombre_chofer,
          c.apellido_chofer,
          e.razon_social as empresa_razon_social,
          gr.enlace_del_pdf,
          gr.enlace_del_xml,
          gr.enlace_del_cdr,
          gr.estado_gre,
          gr.duplicado_origen_id,
          gr.duplicado_fecha,
          gr.duplicado_lote_id,
          p.nombre as nombre_proyecto,
          sp.nombre as nombre_subproyecto
        FROM programacion_tecnica pt
        LEFT JOIN camiones c ON pt.unidad = c.id_camion
        LEFT JOIN empresas_2025 e ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
        LEFT JOIN guia_remision_extendido gr ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
        LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
        LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
        WHERE gr.duplicado_origen_id IS NOT NULL AND gr.duplicado_origen_id > 0
        ORDER BY gr.duplicado_lote_id, gr.duplicado_fecha DESC
      `;

      // Mapear resultados al formato esperado
      const data = programacionTecnica.map(pt => this.mapProgramacionTecnicaData(pt));

      this.logger.log(`Encontradas ${data.length} guías duplicadas`);
      return data;
    } catch (error) {
      this.logger.error('Error al obtener guías duplicadas:', error);
      throw new InternalServerErrorException('Error al obtener guías duplicadas');
    }
  }

  // ✅ NUEVO FLUJO OPCIÓN B: Solo devuelve estructura de datos, NO guarda en BD
  async duplicarGuia(
    idGuiaOriginal: number,
    cantidad: number,
    modificaciones?: Array<Partial<any>>,
  ) {
    try {
      // Validaciones
      if (cantidad < 1 || cantidad > 50) {
        throw new BadRequestException('La cantidad debe estar entre 1 y 50');
      }

      // Obtener guía original de programacion_tecnica con todos los datos necesarios
      const guiaOriginalData = await this.prisma.$queryRaw<any[]>`
        SELECT
          pt.*,
          c.placa as camion_placa,
          c.dni as camion_dni,
          c.nombre_chofer as camion_nombre_chofer,
          c.apellido_chofer as camion_apellido_chofer,
          c.numero_licencia as camion_numero_licencia,
          e.nro_documento as empresa_nro_documento,
          e.razon_social as empresa_razon_social,
          e.direccion as empresa_direccion,
          p.nombre as nombre_proyecto,
          sp.nombre as nombre_subproyecto
        FROM programacion_tecnica pt
        LEFT JOIN camiones c ON pt.unidad = c.id_camion
        LEFT JOIN empresas_2025 e ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
        LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
        LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
        WHERE pt.id = ${idGuiaOriginal}
      `;

      if (!guiaOriginalData || guiaOriginalData.length === 0) {
        throw new BadRequestException('Guía original no encontrada');
      }

      const guiaOriginal = guiaOriginalData[0];

      // Verificar si tiene guía de remisión en tabla extendida
      const guiaRemisionOriginal = await this.prisma.guia_remision_extendido.findFirst({
        where: { identificador_unico: guiaOriginal.identificador_unico },
      });

      // Validar que no tenga archivos generados
      if (guiaRemisionOriginal) {
        if (
          guiaRemisionOriginal.enlace_del_pdf ||
          guiaRemisionOriginal.enlace_del_xml ||
          guiaRemisionOriginal.enlace_del_cdr
        ) {
          throw new BadRequestException(
            'No se puede duplicar una guía que ya tiene archivos generados',
          );
        }
      }

      // Validar datos obligatorios
      const camposVacios: string[] = [];
      if (!guiaOriginal.empresa_nro_documento) camposVacios.push('Número de documento de la empresa');
      if (!guiaOriginal.empresa_razon_social) camposVacios.push('Razón social de la empresa');
      if (!guiaOriginal.empresa_direccion) camposVacios.push('Dirección de la empresa');
      if (!guiaOriginal.camion_placa) camposVacios.push('Placa del vehículo');
      if (!guiaOriginal.camion_dni) camposVacios.push('DNI del conductor');
      if (!guiaOriginal.camion_nombre_chofer) camposVacios.push('Nombre del conductor');
      if (!guiaOriginal.camion_apellido_chofer) camposVacios.push('Apellidos del conductor');
      if (!guiaOriginal.camion_numero_licencia) camposVacios.push('Número de licencia del conductor');
      if (!guiaOriginal.punto_partida_ubigeo || guiaOriginal.punto_partida_ubigeo.length !== 6) {
        camposVacios.push('Ubigeo de partida (debe tener 6 dígitos)');
      }
      if (!guiaOriginal.punto_partida_direccion) camposVacios.push('Dirección de partida');
      if (!guiaOriginal.punto_llegada_ubigeo || guiaOriginal.punto_llegada_ubigeo.length !== 6) {
        camposVacios.push('Ubigeo de llegada (debe tener 6 dígitos)');
      }
      if (!guiaOriginal.punto_llegada_direccion) camposVacios.push('Dirección de llegada');

      if (camposVacios.length > 0) {
        throw new BadRequestException(
          `No se puede duplicar. La guía original tiene campos incompletos: ${camposVacios.join(', ')}. ` +
          `Por favor, complete estos datos en la guía original antes de duplicar.`
        );
      }

      this.logger.log(`🎫 Preparando ${cantidad} duplicados (estructura en memoria, NO se guardan en BD todavía)`);

      // Preparar estructuras de datos para el frontend (sin guardar en BD)
      const duplicadosPreparados: any[] = [];

      for (let i = 0; i < cantidad; i++) {
        // Generar identificador único temporal (se regenerará al guardar)
        const tempIdentificadorUnico = `TEMP-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 8)}`;

        // Aplicar modificaciones si las hay
        const modificacion = modificaciones && modificaciones[i] ? modificaciones[i] : {};

        // Preparar datos del duplicado
        const duplicadoData = {
          // Datos temporales para el frontend
          tempId: `temp-${i}-${Date.now()}`,
          identificador_unico: tempIdentificadorUnico,

          // Datos de la guía original
          fecha: guiaOriginal.fecha,
          unidad: guiaOriginal.camion_placa || null,
          proveedor: guiaOriginal.empresa_razon_social || null,
          apellidos_nombres: this.capitalizeWords(guiaOriginal.camion_nombre_chofer) && this.capitalizeWords(guiaOriginal.camion_apellido_chofer)
            ? `${this.capitalizeWords(guiaOriginal.camion_nombre_chofer)} ${this.capitalizeWords(guiaOriginal.camion_apellido_chofer)}`
            : null,
          proyectos: guiaOriginal.nombre_subproyecto || guiaOriginal.nombre_proyecto || null,
          tipo_proyecto: guiaOriginal.nombre_subproyecto ? 'subproyecto' : guiaOriginal.nombre_proyecto ? 'proyecto' : null,
          programacion: guiaOriginal.programacion,
          hora_partida: guiaOriginal.hora_partida,
          estado_programacion: guiaOriginal.estado_programacion,
          comentarios: guiaOriginal.comentarios,
          validacion: guiaOriginal.validacion,
          km_del_dia: guiaOriginal.km_del_dia,
          mes: guiaOriginal.mes,
          num_semana: guiaOriginal.num_semana,
          m3: guiaOriginal.m3 ? guiaOriginal.m3.toString() : null,
          cantidad_viaje: "1",

          // Campos editables
          peso_bruto_total: modificacion.peso_bruto_total !== undefined
            ? modificacion.peso_bruto_total
            : (guiaRemisionOriginal?.peso_bruto_total || 0),

          // IDs de proyecto
          id_proyecto: modificacion.id_proyecto !== undefined ? modificacion.id_proyecto : guiaOriginal.id_proyecto,
          id_etapa: modificacion.id_etapa !== undefined ? modificacion.id_etapa : guiaOriginal.id_etapa,
          id_sector: modificacion.id_sector !== undefined ? modificacion.id_sector : guiaOriginal.id_sector,
          id_frente: modificacion.id_frente !== undefined ? modificacion.id_frente : guiaOriginal.id_frente,
          id_partida: modificacion.id_partida !== undefined ? modificacion.id_partida : guiaOriginal.id_partida,
          id_subproyecto: modificacion.id_subproyecto !== undefined ? modificacion.id_subproyecto : guiaOriginal.id_subproyecto,
          id_subetapa: modificacion.id_subetapa !== undefined ? modificacion.id_subetapa : guiaOriginal.id_subetapa,
          id_subsector: modificacion.id_subsector !== undefined ? modificacion.id_subsector : guiaOriginal.id_subsector,
          id_subfrente: modificacion.id_subfrente !== undefined ? modificacion.id_subfrente : guiaOriginal.id_subfrente,
          id_subpartida: modificacion.id_subpartida !== undefined ? modificacion.id_subpartida : guiaOriginal.id_subpartida,

          // Datos completos de la guía para guardar después
          _datosCompletos: {
            idGuiaOriginal,
            guiaOriginal: {
              fecha: guiaOriginal.fecha,
              unidad: guiaOriginal.unidad,
              proveedor: guiaOriginal.proveedor,
              empresa_nro_documento: guiaOriginal.empresa_nro_documento,
              empresa_razon_social: guiaOriginal.empresa_razon_social,
              empresa_direccion: guiaOriginal.empresa_direccion,
              camion_placa: guiaOriginal.camion_placa,
              camion_dni: guiaOriginal.camion_dni,
              camion_nombre_chofer: guiaOriginal.camion_nombre_chofer,
              camion_apellido_chofer: guiaOriginal.camion_apellido_chofer,
              camion_numero_licencia: guiaOriginal.camion_numero_licencia,
              punto_partida_ubigeo: guiaOriginal.punto_partida_ubigeo,
              punto_partida_direccion: guiaOriginal.punto_partida_direccion,
              punto_llegada_ubigeo: guiaOriginal.punto_llegada_ubigeo,
              punto_llegada_direccion: guiaOriginal.punto_llegada_direccion,
              programacion: guiaOriginal.programacion,
              hora_partida: guiaOriginal.hora_partida,
              estado_programacion: guiaOriginal.estado_programacion,
              comentarios: guiaOriginal.comentarios,
              validacion: guiaOriginal.validacion,
              km_del_dia: guiaOriginal.km_del_dia,
              mes: guiaOriginal.mes,
              num_semana: guiaOriginal.num_semana,
              m3: guiaOriginal.m3,
            },
            guiaRemisionOriginal: guiaRemisionOriginal ? {
              operacion: guiaRemisionOriginal.operacion,
              tipo_de_comprobante: guiaRemisionOriginal.tipo_de_comprobante,
              cliente_tipo_de_documento: guiaRemisionOriginal.cliente_tipo_de_documento,
              cliente_numero_de_documento: guiaRemisionOriginal.cliente_numero_de_documento,
              cliente_denominacion: guiaRemisionOriginal.cliente_denominacion,
              cliente_direccion: guiaRemisionOriginal.cliente_direccion,
              fecha_de_emision: guiaRemisionOriginal.fecha_de_emision,
              peso_bruto_unidad_de_medida: guiaRemisionOriginal.peso_bruto_unidad_de_medida,
              numero_de_bultos: guiaRemisionOriginal.numero_de_bultos,
              tipo_de_transporte: guiaRemisionOriginal.tipo_de_transporte,
              fecha_de_inicio_de_traslado: guiaRemisionOriginal.fecha_de_inicio_de_traslado,
              transportista_placa_numero: guiaRemisionOriginal.transportista_placa_numero,
              transportista_documento_tipo: guiaRemisionOriginal.transportista_documento_tipo,
              transportista_documento_numero: guiaRemisionOriginal.transportista_documento_numero,
              transportista_denominacion: guiaRemisionOriginal.transportista_denominacion,
              conductor_documento_tipo: guiaRemisionOriginal.conductor_documento_tipo,
              conductor_documento_numero: guiaRemisionOriginal.conductor_documento_numero,
              conductor_numero_licencia: guiaRemisionOriginal.conductor_numero_licencia,
              conductor_nombre: guiaRemisionOriginal.conductor_nombre,
              conductor_apellidos: guiaRemisionOriginal.conductor_apellidos,
              conductor_denominacion: guiaRemisionOriginal.conductor_denominacion,
              destinatario_documento_tipo: guiaRemisionOriginal.destinatario_documento_tipo,
              destinatario_documento_numero: guiaRemisionOriginal.destinatario_documento_numero,
              destinatario_denominacion: guiaRemisionOriginal.destinatario_denominacion,
              mtc: guiaRemisionOriginal.mtc,
              punto_de_partida_ubigeo: guiaRemisionOriginal.punto_de_partida_ubigeo,
              punto_de_partida_direccion: guiaRemisionOriginal.punto_de_partida_direccion,
              punto_de_llegada_ubigeo: guiaRemisionOriginal.punto_de_llegada_ubigeo,
              punto_de_llegada_direccion: guiaRemisionOriginal.punto_de_llegada_direccion,
              motivo_de_traslado: guiaRemisionOriginal.motivo_de_traslado,
              motivo_de_traslado_otros_descripcion: guiaRemisionOriginal.motivo_de_traslado_otros_descripcion,
              observaciones: guiaRemisionOriginal.observaciones,
            } : null,
          },
        };

        duplicadosPreparados.push(duplicadoData);
      }

      this.logger.log(`✅ Preparados ${cantidad} duplicados en memoria (listos para editar en frontend)`);

      return {
        success: true,
        message: `Se prepararon ${cantidad} duplicados para edición`,
        duplicados: duplicadosPreparados,
      };
    } catch (error) {
      this.logger.error('Error al preparar duplicados:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al preparar duplicados');
    }
  }

  // ✅ NUEVO MÉTODO: Guarda los duplicados editados en BD con estado_gre: null
  // El detector los procesará automáticamente
  async guardarDuplicados(duplicados: Array<any>) {
    try {
      this.logger.log(`📝 Guardando ${duplicados.length} duplicados en la base de datos...`);

      // 🔍 DEBUG: Ver qué items vienen desde el frontend
      duplicados.forEach((dup, index) => {
        console.log(`\n🔍 [GUARDAR-DUPLICADOS] Duplicado ${index + 1}:`, {
          peso_bruto_total: dup.peso_bruto_total,
          items_raw: dup.items,
          items_parsed: dup.items ? JSON.parse(dup.items) : null
        });
      });

      const resultados = await this.prisma.$transaction(async (tx) => {
        const guiasCreadas: any[] = [];

        // Obtener el último número usado en la serie 'TTT2' para autoincrement
        const ultimoNumero = await tx.guia_remision_extendido.findFirst({
          where: { serie: 'TTT2' },
          orderBy: { numero: 'desc' },
          select: { numero: true }
        });

        let numeroActual = ultimoNumero ? ultimoNumero.numero : 0;
        this.logger.log(`   📝 Último número en serie TTT2: ${numeroActual}, iniciando desde ${numeroActual + 1}`);

        for (const duplicado of duplicados) {
          numeroActual++;

          // Generar nuevo identificador único real
          const nuevoIdentificadorUnico = generarIdentificadorAleatorio();

          const datosCompletos = duplicado._datosCompletos;
          const guiaOriginal = datosCompletos.guiaOriginal;
          const guiaRemisionOriginal = datosCompletos.guiaRemisionOriginal;

          // Crear registro en guia_remision_extendido con estado_gre: null
          // SIN duplicado_lote_id para que el detector lo procese automáticamente
          let nuevoRegistroGre;

          if (guiaRemisionOriginal) {
            // Si hay guía de remisión original, usar esos datos
            nuevoRegistroGre = await tx.guia_remision_extendido.create({
              data: {
                operacion: guiaRemisionOriginal.operacion,
                tipo_de_comprobante: guiaRemisionOriginal.tipo_de_comprobante,
                serie: 'TTT2',
                numero: numeroActual,
                cliente_tipo_de_documento: guiaRemisionOriginal.cliente_tipo_de_documento,
                cliente_numero_de_documento: guiaRemisionOriginal.cliente_numero_de_documento,
                cliente_denominacion: guiaRemisionOriginal.cliente_denominacion,
                cliente_direccion: guiaRemisionOriginal.cliente_direccion,
                fecha_de_emision: guiaRemisionOriginal.fecha_de_emision,
                peso_bruto_total: duplicado.peso_bruto_total, // Valor editado
                peso_bruto_unidad_de_medida: guiaRemisionOriginal.peso_bruto_unidad_de_medida,
                numero_de_bultos: guiaRemisionOriginal.numero_de_bultos,
                tipo_de_transporte: guiaRemisionOriginal.tipo_de_transporte,
                fecha_de_inicio_de_traslado: guiaRemisionOriginal.fecha_de_inicio_de_traslado,
                transportista_placa_numero: guiaRemisionOriginal.transportista_placa_numero,
                transportista_documento_tipo: guiaRemisionOriginal.transportista_documento_tipo,
                transportista_documento_numero: guiaRemisionOriginal.transportista_documento_numero,
                transportista_denominacion: guiaRemisionOriginal.transportista_denominacion,
                conductor_documento_tipo: guiaRemisionOriginal.conductor_documento_tipo,
                conductor_documento_numero: guiaRemisionOriginal.conductor_documento_numero,
                conductor_numero_licencia: guiaRemisionOriginal.conductor_numero_licencia,
                conductor_nombre: guiaRemisionOriginal.conductor_nombre,
                conductor_apellidos: guiaRemisionOriginal.conductor_apellidos,
                conductor_denominacion: guiaRemisionOriginal.conductor_denominacion,
                destinatario_documento_tipo: guiaRemisionOriginal.destinatario_documento_tipo,
                destinatario_documento_numero: guiaRemisionOriginal.destinatario_documento_numero,
                destinatario_denominacion: guiaRemisionOriginal.destinatario_denominacion,
                mtc: guiaRemisionOriginal.mtc,
                punto_de_partida_ubigeo: guiaRemisionOriginal.punto_de_partida_ubigeo,
                punto_de_partida_direccion: guiaRemisionOriginal.punto_de_partida_direccion,
                punto_de_llegada_ubigeo: guiaRemisionOriginal.punto_de_llegada_ubigeo,
                punto_de_llegada_direccion: guiaRemisionOriginal.punto_de_llegada_direccion,
                motivo_de_traslado: guiaRemisionOriginal.motivo_de_traslado,
                motivo_de_traslado_otros_descripcion: guiaRemisionOriginal.motivo_de_traslado_otros_descripcion,
                observaciones: guiaRemisionOriginal.observaciones,
                identificador_unico: nuevoIdentificadorUnico,
                // ✅ Sin duplicado_lote_id y con estado_gre: null para que el detector lo procese
                estado_gre: null,
                aceptada_por_sunat: null,
                sunat_description: null,
                // Valores editados de proyecto
                id_proyecto: duplicado.id_proyecto || null,
                id_etapa: duplicado.id_etapa || null,
                id_sector: duplicado.id_sector || null,
                id_frente: duplicado.id_frente || null,
                id_partida: duplicado.id_partida || null,
                id_subproyecto: duplicado.id_subproyecto || null,
                id_subetapa: duplicado.id_subetapa || null,
                id_subsector: duplicado.id_subsector || null,
                id_subfrente: duplicado.id_subfrente || null,
                id_subpartida: duplicado.id_subpartida || null,
                // ✅ NUEVO: Guardar items con código
                items: duplicado.items || null,
              },
            });
          } else {
            // Crear con datos de la programación técnica
            nuevoRegistroGre = await tx.guia_remision_extendido.create({
              data: {
                operacion: 'generar_guia',
                tipo_de_comprobante: 7,
                serie: 'TTT2',
                numero: numeroActual,
                cliente_tipo_de_documento: 6,
                cliente_numero_de_documento: guiaOriginal.empresa_nro_documento,
                cliente_denominacion: guiaOriginal.empresa_razon_social,
                cliente_direccion: guiaOriginal.empresa_direccion,
                fecha_de_emision: guiaOriginal.fecha,
                peso_bruto_total: duplicado.peso_bruto_total, // Valor editado
                peso_bruto_unidad_de_medida: 'TNE',
                numero_de_bultos: 1,
                tipo_de_transporte: '02',
                fecha_de_inicio_de_traslado: guiaOriginal.fecha,
                transportista_placa_numero: guiaOriginal.camion_placa,
                transportista_documento_tipo: 6,
                transportista_documento_numero: guiaOriginal.empresa_nro_documento,
                transportista_denominacion: guiaOriginal.empresa_razon_social,
                conductor_documento_tipo: 1,
                conductor_documento_numero: guiaOriginal.camion_dni,
                conductor_nombre: guiaOriginal.camion_nombre_chofer,
                conductor_apellidos: guiaOriginal.camion_apellido_chofer,
                conductor_numero_licencia: guiaOriginal.camion_numero_licencia,
                destinatario_documento_tipo: 6,
                destinatario_documento_numero: guiaOriginal.empresa_nro_documento,
                destinatario_denominacion: guiaOriginal.empresa_razon_social,
                mtc: null,
                punto_de_partida_ubigeo: guiaOriginal.punto_partida_ubigeo,
                punto_de_partida_direccion: guiaOriginal.punto_partida_direccion,
                punto_de_llegada_ubigeo: guiaOriginal.punto_llegada_ubigeo,
                punto_de_llegada_direccion: guiaOriginal.punto_llegada_direccion,
                motivo_de_traslado: '01',
                motivo_de_traslado_otros_descripcion: null,
                observaciones: null,
                identificador_unico: nuevoIdentificadorUnico,
                // ✅ Sin duplicado_lote_id y con estado_gre: null para que el detector lo procese
                estado_gre: null,
                aceptada_por_sunat: null,
                sunat_description: null,
                // Valores editados de proyecto
                id_proyecto: duplicado.id_proyecto || null,
                id_etapa: duplicado.id_etapa || null,
                id_sector: duplicado.id_sector || null,
                id_frente: duplicado.id_frente || null,
                id_partida: duplicado.id_partida || null,
                id_subproyecto: duplicado.id_subproyecto || null,
                id_subetapa: duplicado.id_subetapa || null,
                id_subsector: duplicado.id_subsector || null,
                id_subfrente: duplicado.id_subfrente || null,
                id_subpartida: duplicado.id_subpartida || null,
                // ✅ NUEVO: Guardar items con código
                items: duplicado.items || null,
              },
            });
          }

          this.logger.log(`   ✅ Guardado duplicado TTT2-${numeroActual} (id: ${nuevoRegistroGre.id_guia})`);
          console.log(`   🔍 [DB-SAVED] Items guardados en BD:`, nuevoRegistroGre.items);

          guiasCreadas.push({
            id_guia: nuevoRegistroGre.id_guia,
            identificador_unico: nuevoIdentificadorUnico,
            serie: 'TTT2',
            numero: numeroActual,
          });
        }

        return guiasCreadas;
      });

      this.logger.log(`✅ Se guardaron ${resultados.length} duplicados exitosamente`);
      this.logger.log(`🤖 El detector los procesará automáticamente en los próximos 30 segundos`);

      return {
        success: true,
        message: `Se guardaron ${resultados.length} duplicados exitosamente. El sistema los procesará automáticamente.`,
        guiasCreadas: resultados,
      };
    } catch (error) {
      this.logger.error('Error al guardar duplicados:', error);
      throw new InternalServerErrorException('Error al guardar duplicados');
    }
  }

  async actualizarDuplicadosLote(
    loteId: string,
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
    },
  ) {
    try {
      this.logger.log(`Actualizando duplicados del lote ${loteId}`);
      this.logger.log(`Modificaciones: ${JSON.stringify(modificaciones)}`);

      // Primero verificar cuántos registros existen con este lote
      const existentes = await this.prisma.guia_remision_extendido.findMany({
        where: {
          duplicado_lote_id: loteId,
        },
        select: {
          id_guia: true,
          duplicado_lote_id: true,
        }
      });

      this.logger.log(`🔍 Encontrados ${existentes.length} registros con loteId: ${loteId}`);
      if (existentes.length > 0) {
        this.logger.log(`   IDs: ${existentes.map(e => e.id_guia).join(', ')}`);
      }

      // Si no hay registros, lanzar error
      if (existentes.length === 0) {
        throw new BadRequestException(
          `No se encontraron duplicados con el lote ${loteId}. El lote puede haber sido eliminado o no existe.`
        );
      }

      // Actualizar todos los duplicados del lote en guia_remision_extendido
      const result = await this.prisma.guia_remision_extendido.updateMany({
        where: {
          duplicado_lote_id: loteId,
        },
        data: modificaciones,
      });

      this.logger.log(`✏️  Actualizados ${result.count} registros en guia_remision_extendido`);

      // ✅ NO actualizar programacion_tecnica porque esos registros aún no existen
      // Se crearán cuando se envíe a Kafka con los datos actualizados de guia_remision_extendido
      this.logger.log(`📌 Los registros en programacion_tecnica se crearán al enviar a Kafka`);

      return {
        success: true,
        message: `Se actualizaron ${result.count} duplicados del lote ${loteId}`,
        registrosActualizados: result.count,
      };
    } catch (error) {
      this.logger.error('Error al actualizar duplicados:', error);
      throw new InternalServerErrorException('Error al actualizar duplicados');
    }
  }

  private validarCamposObligatoriosParaNubefact(
    guia: any,
    guiaRemision: any,
    index: number
  ): { valido: boolean; camposFaltantes: string[] } {
    const camposFaltantes: string[] = [];

    // Validar campos de guia_remision_extendido (campos principales)
    if (!guiaRemision.peso_bruto_total || guiaRemision.peso_bruto_total <= 0) {
      camposFaltantes.push('peso_bruto_total');
    }

    // Validar proyecto o subproyecto
    const tieneProyecto = guiaRemision.id_proyecto && guiaRemision.id_proyecto > 0;
    const tieneSubproyecto = guiaRemision.id_subproyecto && guiaRemision.id_subproyecto > 0;

    if (!tieneProyecto && !tieneSubproyecto) {
      camposFaltantes.push('id_proyecto o id_subproyecto');
    } else if (tieneProyecto) {
      if (!guiaRemision.id_etapa) camposFaltantes.push('id_etapa');
      if (!guiaRemision.id_sector) camposFaltantes.push('id_sector');
      if (!guiaRemision.id_frente) camposFaltantes.push('id_frente');
      if (!guiaRemision.id_partida) camposFaltantes.push('id_partida');
    } else if (tieneSubproyecto) {
      if (!guiaRemision.id_subetapa) camposFaltantes.push('id_subetapa');
      if (!guiaRemision.id_subsector) camposFaltantes.push('id_subsector');
      if (!guiaRemision.id_subfrente) camposFaltantes.push('id_subfrente');
      if (!guiaRemision.id_subpartida) camposFaltantes.push('id_subpartida');
    }

    // Campos básicos de guia_remision_extendido
    if (!guiaRemision.cliente_denominacion) camposFaltantes.push('cliente_denominacion');
    if (!guiaRemision.cliente_numero_de_documento) camposFaltantes.push('cliente_numero_de_documento');
    if (!guiaRemision.fecha_de_emision) camposFaltantes.push('fecha_de_emision');

    // Campos necesarios para GRE (transporte)
    if (!guiaRemision.transportista_placa_numero) camposFaltantes.push('transportista_placa_numero');
    if (!guiaRemision.conductor_documento_numero) camposFaltantes.push('conductor_documento_numero');
    if (!guiaRemision.conductor_numero_licencia) camposFaltantes.push('conductor_numero_licencia');
    if (!guiaRemision.conductor_nombre) camposFaltantes.push('conductor_nombre');
    if (!guiaRemision.conductor_apellidos) camposFaltantes.push('conductor_apellidos');

    // Puntos de partida y llegada
    if (!guiaRemision.punto_de_partida_direccion) camposFaltantes.push('punto_de_partida_direccion');
    if (!guiaRemision.punto_de_partida_ubigeo) camposFaltantes.push('punto_de_partida_ubigeo');
    if (!guiaRemision.punto_de_llegada_direccion) camposFaltantes.push('punto_de_llegada_direccion');
    if (!guiaRemision.punto_de_llegada_ubigeo) camposFaltantes.push('punto_de_llegada_ubigeo');

    // Datos del transportista
    if (!guiaRemision.transportista_documento_numero) camposFaltantes.push('transportista_documento_numero');
    if (!guiaRemision.transportista_denominacion) camposFaltantes.push('transportista_denominacion');

    // Validar campos de programacion_tecnica (opcionales pero útiles para logs)
    if (!guia.unidad) camposFaltantes.push('unidad (programacion_tecnica)');
    if (!guia.proveedor) camposFaltantes.push('proveedor (programacion_tecnica)');

    return {
      valido: camposFaltantes.length === 0,
      camposFaltantes
    };
  }

  async enviarDuplicadosKafka(loteId: string, idsGuias: number[]) {
    try {
      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`📤 INICIANDO ENVÍO DE DUPLICADOS A NUBEFACT`);
      this.logger.log(`   Lote ID: ${loteId}`);
      this.logger.log(`   Total de guías: ${idsGuias.length}`);
      this.logger.log(`${'='.repeat(80)}\n`);

      // Validar que el lote existe antes de procesar
      const loteExiste = await this.prisma.guia_remision_extendido.count({
        where: { duplicado_lote_id: loteId }
      });

      if (loteExiste === 0) {
        this.logger.error(`❌ El lote ${loteId} no existe en la base de datos`);
        throw new BadRequestException(
          `El lote ${loteId} no existe. Los duplicados pueden haber sido eliminados o el lote es inválido. Por favor, recargue la página y verifique los datos.`
        );
      }

      this.logger.log(`✅ Lote validado: ${loteExiste} registros encontrados`);

      let procesados = 0;
      const errores: Array<{ id: number; error: string }> = [];
      const validacionesDetalladas: Array<{ id: number; valido: boolean; camposFaltantes: string[] }> = [];

      for (const idGuia of idsGuias) {
        try {
          this.logger.log(`\n🔍 Validando guía ID: ${idGuia}`);

          // Verificar que la guía exista
          const guia = await this.prisma.programacion_tecnica.findUnique({
            where: { id: idGuia },
          });

          if (!guia) {
            this.logger.error(`❌ Guía ${idGuia} no encontrada en la base de datos`);
            errores.push({
              id: idGuia,
              error: 'Guía no encontrada',
            });
            validacionesDetalladas.push({
              id: idGuia,
              valido: false,
              camposFaltantes: ['guia_no_existe']
            });
            continue;
          }

          // Verificar que pertenezca al lote
          const guiaRemision = await this.prisma.guia_remision_extendido.findFirst({
            where: {
              identificador_unico: guia.identificador_unico,
              duplicado_lote_id: loteId,
            },
          });

          if (!guiaRemision) {
            // Verificar si la guía existe pero en otro lote
            const guiaEnOtroLote = await this.prisma.guia_remision_extendido.findFirst({
              where: {
                identificador_unico: guia.identificador_unico,
              },
              select: {
                duplicado_lote_id: true,
                id_guia: true,
              }
            });

            if (guiaEnOtroLote) {
              this.logger.error(`❌ Guía ${idGuia} pertenece a otro lote: ${guiaEnOtroLote.duplicado_lote_id}`);
              errores.push({
                id: idGuia,
                error: `Guía pertenece al lote ${guiaEnOtroLote.duplicado_lote_id}, no al lote ${loteId}`,
              });
            } else {
              this.logger.error(`❌ Guía ${idGuia} no tiene registro en guia_remision_extendido`);
              errores.push({
                id: idGuia,
                error: 'Guía no encontrada en tabla de duplicados',
              });
            }

            validacionesDetalladas.push({
              id: idGuia,
              valido: false,
              camposFaltantes: ['no_pertenece_al_lote']
            });
            continue;
          }

          // Validar campos obligatorios para Nubefact
          const validacion = this.validarCamposObligatoriosParaNubefact(guia, guiaRemision, procesados);
          validacionesDetalladas.push({
            id: idGuia,
            valido: validacion.valido,
            camposFaltantes: validacion.camposFaltantes
          });

          if (!validacion.valido) {
            const mensajeError = `Campos faltantes: ${validacion.camposFaltantes.join(', ')}`;
            this.logger.error(`❌ Guía ${idGuia} NO VÁLIDA para envío a Nubefact`);
            this.logger.error(`   ${mensajeError}`);
            this.logger.error(`   Datos actuales de guia_remision_extendido:`);
            this.logger.error(`     - peso_bruto_total: ${guiaRemision.peso_bruto_total || 'NULL'}`);
            this.logger.error(`     - id_proyecto: ${guiaRemision.id_proyecto || 'NULL'}`);
            this.logger.error(`     - id_subproyecto: ${guiaRemision.id_subproyecto || 'NULL'}`);
            this.logger.error(`     - id_etapa: ${guiaRemision.id_etapa || 'NULL'}`);
            this.logger.error(`     - id_sector: ${guiaRemision.id_sector || 'NULL'}`);
            this.logger.error(`     - id_frente: ${guiaRemision.id_frente || 'NULL'}`);
            this.logger.error(`     - id_partida: ${guiaRemision.id_partida || 'NULL'}`);
            this.logger.error(`     - cliente_denominacion: ${guiaRemision.cliente_denominacion || 'NULL'}`);
            this.logger.error(`     - transportista_placa_numero: ${guiaRemision.transportista_placa_numero || 'NULL'}`);
            this.logger.error(`     - conductor_documento_numero: ${guiaRemision.conductor_documento_numero || 'NULL'}`);
            this.logger.error(`     - conductor_numero_licencia: ${guiaRemision.conductor_numero_licencia || 'NULL'}`);
            this.logger.error(`     - conductor_nombre: ${guiaRemision.conductor_nombre || 'NULL'}`);
            this.logger.error(`     - conductor_apellidos: ${guiaRemision.conductor_apellidos || 'NULL'}`);
            this.logger.error(`     - punto_de_partida_direccion: ${guiaRemision.punto_de_partida_direccion || 'NULL'}`);
            this.logger.error(`     - punto_de_llegada_direccion: ${guiaRemision.punto_de_llegada_direccion || 'NULL'}`);
            this.logger.error(`   Datos de programacion_tecnica:`);
            this.logger.error(`     - unidad: ${guia.unidad || 'NULL'}`);
            this.logger.error(`     - proveedor: ${guia.proveedor || 'NULL'}`);

            errores.push({
              id: idGuia,
              error: mensajeError,
            });
            continue;
          }

          this.logger.log(`✅ Guía ${idGuia} VÁLIDA - Todos los campos obligatorios presentes`);
          this.logger.log(`   - peso_bruto_total: ${guiaRemision.peso_bruto_total}`);
          this.logger.log(`   - proyecto/subproyecto: ${guiaRemision.id_proyecto ? `Proyecto ${guiaRemision.id_proyecto}` : `Subproyecto ${guiaRemision.id_subproyecto}`}`);
          this.logger.log(`   - placa: ${guiaRemision.transportista_placa_numero}`);
          this.logger.log(`   - conductor: ${guiaRemision.conductor_nombre} ${guiaRemision.conductor_apellidos} (DNI: ${guiaRemision.conductor_documento_numero})`);
          this.logger.log(`   - transportista: ${guiaRemision.transportista_denominacion} (RUC: ${guiaRemision.transportista_documento_numero})`);

          // ✅ PASO 1: Crear registro en programacion_tecnica ANTES de enviar a Kafka
          this.logger.log(`📝 Creando registro en programacion_tecnica para guía ${idGuia}...`);
          try {
            await this.prisma.programacion_tecnica.create({
              data: {
                fecha: guia.fecha,
                unidad: guia.unidad,
                proveedor: guia.proveedor,
                programacion: guia.programacion,
                hora_partida: guia.hora_partida,
                estado_programacion: guia.estado_programacion,
                comentarios: guia.comentarios,
                validacion: guia.validacion,
                identificador_unico: guia.identificador_unico,
                km_del_dia: guia.km_del_dia,
                mes: guia.mes,
                num_semana: guia.num_semana,
                m3: guia.m3,
                cantidad_viaje: "1", // Siempre 1 viaje por duplicado
                peso_bruto_total: guiaRemision.peso_bruto_total,
                punto_llegada_direccion: guiaRemision.punto_de_llegada_direccion,
                punto_llegada_ubigeo: guiaRemision.punto_de_llegada_ubigeo,
                punto_partida_direccion: guiaRemision.punto_de_partida_direccion,
                punto_partida_ubigeo: guiaRemision.punto_de_partida_ubigeo,
                id_proyecto: guiaRemision.id_proyecto,
                id_subproyecto: guiaRemision.id_subproyecto,
                id_etapa: guiaRemision.id_etapa,
                id_sector: guiaRemision.id_sector,
                id_frente: guiaRemision.id_frente,
                id_partida: guiaRemision.id_partida,
                id_subetapa: guiaRemision.id_subetapa,
                id_subsector: guiaRemision.id_subsector,
                id_subfrente: guiaRemision.id_subfrente,
                id_subpartida: guiaRemision.id_subpartida,
                hora_registro: new Date(),
              },
            });
            this.logger.log(`✅ Registro creado en programacion_tecnica para guía ${idGuia}`);
          } catch (error) {
            this.logger.error(`❌ Error creando registro en programacion_tecnica para guía ${idGuia}:`, error.message);
            errores.push({
              id: idGuia,
              error: `Error creando en programacion_tecnica: ${error.message}`,
            });
            continue;
          }

          // ✅ PASO 2: Actualizar estado a PENDIENTE en guia_remision_extendido
          this.logger.log(`📝 Actualizando estado a PENDIENTE para guía ${idGuia}...`);
          await this.prisma.guia_remision_extendido.update({
            where: { id_guia: guiaRemision.id_guia },
            data: {
              estado_gre: 'PENDIENTE',
              duplicado_lote_id: null, // Limpiar loteId para que no sea filtrado por el detector
            },
          });
          this.logger.log(`✅ Estado actualizado a PENDIENTE para guía ${idGuia}`);

          // ✅ PASO 3: Transformar datos al formato de Nubefact y enviar a Kafka
          const greData = this.transformRecordToNubefactApi(guiaRemision);

          if (this.greExtendidoProducer) {
            await this.greExtendidoProducer.sendGreRequest(
              guiaRemision.id_guia.toString(),
              greData
            );
            this.logger.log(`📤 Guía ${idGuia} enviada a Kafka exitosamente`);
          } else {
            this.logger.warn(`⚠️  GreExtendidoProducer no disponible, solo se actualizó el estado`);
          }

          procesados++;
        } catch (error) {
          this.logger.error(`❌ Error procesando guía ${idGuia}:`, error.message);
          errores.push({
            id: idGuia,
            error: error.message,
          });
        }
      }

      // Resumen final
      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`📊 RESUMEN DE VALIDACIÓN`);
      this.logger.log(`   Total procesadas: ${idsGuias.length}`);
      this.logger.log(`   ✅ Válidas: ${procesados}`);
      this.logger.log(`   ❌ Inválidas: ${errores.length}`);

      if (errores.length > 0) {
        this.logger.error(`\n⚠️  GUÍAS CON ERRORES:`);
        validacionesDetalladas.filter(v => !v.valido).forEach((v) => {
          this.logger.error(`   Guía ${v.id}: ${v.camposFaltantes.join(', ')}`);
        });
      }

      this.logger.log(`${'='.repeat(80)}\n`);

      return {
        success: true,
        message: `Se procesaron ${procesados} de ${idsGuias.length} guías`,
        procesados,
        errores,
      };
    } catch (error) {
      this.logger.error('Error al enviar duplicados a Kafka:', error);
      throw new InternalServerErrorException('Error al enviar duplicados a Kafka');
    }
  }

  async eliminarDuplicados(loteId: string) {
    try {
      // Verificar que no tengan archivos generados
      const guiasConArchivos = await this.prisma.guia_remision_extendido.count({
        where: {
          duplicado_lote_id: loteId,
          OR: [
            { enlace_del_pdf: { not: null } },
            { enlace_del_xml: { not: null } },
            { enlace_del_cdr: { not: null } },
          ],
        },
      });

      if (guiasConArchivos > 0) {
        throw new BadRequestException(
          'No se pueden eliminar duplicados que ya tienen archivos generados',
        );
      }

      // ✅ Solo eliminar de guia_remision_extendido
      // Los registros en programacion_tecnica aún no existen (se crean al enviar a Kafka)
      const result = await this.prisma.guia_remision_extendido.deleteMany({
        where: { duplicado_lote_id: loteId },
      });

      this.logger.log(
        `Se eliminaron ${result.count} duplicados del lote ${loteId} de guia_remision_extendido`,
      );
      this.logger.log(`📌 No se eliminó de programacion_tecnica porque esos registros aún no existen`);

      return {
        success: true,
        message: `Se eliminaron ${result.count} duplicados del lote ${loteId}`,
      };
    } catch (error) {
      this.logger.error('Error al eliminar duplicados:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al eliminar duplicados');
    }
  }

  // Método auxiliar para mapear datos de programación técnica
  private mapProgramacionTecnicaData(pt: any) {
    const nombreCapitalizado = this.capitalizeWords(pt.nombre_chofer);
    const apellidoCapitalizado = this.capitalizeWords(pt.apellido_chofer);
    const nombreCompleto =
      nombreCapitalizado && apellidoCapitalizado
        ? `${nombreCapitalizado} ${apellidoCapitalizado}`
        : null;

    let nombreProyecto: string | null = null;
    let tipoProyecto: 'proyecto' | 'subproyecto' | null = null;

    if (pt.nombre_subproyecto) {
      nombreProyecto = pt.nombre_subproyecto;
      tipoProyecto = 'subproyecto';
    } else if (pt.nombre_proyecto) {
      nombreProyecto = pt.nombre_proyecto;
      tipoProyecto = 'proyecto';
    }

    let horaPartidaISO: string | null = null;
    if (pt.fecha && pt.hora_partida) {
      try {
        const fechaStr = dayjs(pt.fecha).format('YYYY-MM-DD');
        const horaStr = dayjs(pt.hora_partida).format('HH:mm:ss');
        horaPartidaISO = dayjs
          .tz(`${fechaStr} ${horaStr}`, 'YYYY-MM-DD HH:mm:ss', 'America/Lima')
          .toISOString();
      } catch (error) {
        this.logger.warn(
          `Error al combinar fecha y hora para registro ${pt.id}:`,
          error,
        );
        horaPartidaISO = pt.hora_partida;
      }
    }

    return {
      id: pt.id,
      fecha: pt.fecha,
      unidad: pt.unidad_placa || null,
      proveedor: pt.empresa_razon_social || null,
      apellidos_nombres: nombreCompleto,
      proyectos: nombreProyecto,
      tipo_proyecto: tipoProyecto,
      programacion: pt.programacion,
      hora_partida: horaPartidaISO,
      estado_programacion: pt.estado_programacion,
      comentarios: pt.comentarios,
      validacion: pt.validacion,
      identificador_unico: pt.identificador_unico,
      km_del_dia: pt.km_del_dia,
      mes: pt.mes,
      num_semana: pt.num_semana,
      m3: pt.m3 ? pt.m3.toString() : null,
      cantidad_viaje: pt.cantidad_viaje,
      enlace_del_pdf: pt.enlace_del_pdf || null,
      enlace_del_xml: pt.enlace_del_xml || null,
      enlace_del_cdr: pt.enlace_del_cdr || null,
      estado_gre: pt.estado_gre || null,
      duplicado_origen_id: pt.duplicado_origen_id || null,
      duplicado_fecha: pt.duplicado_fecha || null,
      duplicado_lote_id: pt.duplicado_lote_id || null,

      // IDs de Proyecto (necesarios para preseleccionar en frontend)
      id_proyecto: pt.id_proyecto || null,
      id_etapa: pt.id_etapa || null,
      id_sector: pt.id_sector || null,
      id_frente: pt.id_frente || null,
      id_partida: pt.id_partida || null,

      // IDs de Subproyecto
      id_subproyecto: pt.id_subproyecto || null,
      id_subetapa: pt.id_subetapa || null,
      id_subsector: pt.id_subsector || null,
      id_subfrente: pt.id_subfrente || null,
      id_subpartida: pt.id_subpartida || null,

      // Peso bruto (necesario para duplicación)
      peso_bruto_total: pt.peso_bruto_total || null,
    };
  }

  // Método para transformar datos de guia_remision_extendido al formato de Nubefact API
  private transformRecordToNubefactApi(record: any) {
    const formatDate = (date: Date | string) => {
      let dateUTC: dayjs.Dayjs;

      if (typeof date === 'string') {
        dateUTC = dayjs.utc(date);
      } else {
        dateUTC = dayjs(date).utc().add(5, 'hour');
      }

      const formatted = dateUTC.format('DD-MM-YYYY');

      console.log(`📅 [PROGRAMACION-SERVICE] formatDate - Input: ${date} → UTC+5: ${dateUTC.format('YYYY-MM-DD')} → Formatted: ${formatted}`);

      return formatted;
    };

    const payload: any = {
      operacion: record.operacion,
      tipo_de_comprobante: record.tipo_de_comprobante,
      serie: record.serie,
      numero: String(record.numero),
      cliente_tipo_de_documento: record.cliente_tipo_de_documento,
      cliente_numero_de_documento: record.cliente_numero_de_documento,
      cliente_denominacion: record.cliente_denominacion,
      cliente_direccion: record.cliente_direccion,
      fecha_de_emision: formatDate(record.fecha_de_emision),
      peso_bruto_total: String(record.peso_bruto_total),
      peso_bruto_unidad_de_medida: record.peso_bruto_unidad_de_medida,
      fecha_de_inicio_de_traslado: formatDate(record.fecha_de_inicio_de_traslado),
      transportista_placa_numero: record.transportista_placa_numero,
      punto_de_partida_ubigeo: record.punto_de_partida_ubigeo,
      punto_de_partida_direccion: record.punto_de_partida_direccion,
      punto_de_llegada_ubigeo: record.punto_de_llegada_ubigeo,
      punto_de_llegada_direccion: record.punto_de_llegada_direccion,
    };

    // Campos opcionales comunes
    if (record.cliente_email) payload.cliente_email = record.cliente_email;
    payload.cliente_email_1 = record.cliente_email_1 || "";
    payload.cliente_email_2 = record.cliente_email_2 || "";

    if (record.observaciones) payload.observaciones = record.observaciones;
    if (record.mtc) payload.mtc = record.mtc;
    if (record.enviar_automaticamente_al_cliente !== null) {
      payload.enviar_automaticamente_al_cliente = record.enviar_automaticamente_al_cliente;
    }
    payload.formato_de_pdf = record.formato_de_pdf || "";

    // Campos específicos de GRE Remitente (tipo 7)
    if (record.tipo_de_comprobante === 7) {
      payload.motivo_de_traslado = record.motivo_de_traslado;
      payload.numero_de_bultos = String(record.numero_de_bultos);
      payload.tipo_de_transporte = record.tipo_de_transporte;

      if (record.motivo_de_traslado === '13' && record.motivo_de_traslado_otros_descripcion) {
        payload.motivo_de_traslado_otros_descripcion = record.motivo_de_traslado_otros_descripcion;
      }

      // Transportista (si tipo_de_transporte = "01")
      if (record.tipo_de_transporte === '01') {
        if (record.transportista_documento_tipo) {
          payload.transportista_documento_tipo = String(record.transportista_documento_tipo);
        }
        if (record.transportista_documento_numero) {
          payload.transportista_documento_numero = record.transportista_documento_numero;
        }
        if (record.transportista_denominacion) {
          payload.transportista_denominacion = record.transportista_denominacion;
        }
      }

      // Conductor
      if (record.conductor_documento_tipo) {
        payload.conductor_documento_tipo = String(record.conductor_documento_tipo);
      }
      if (record.conductor_documento_numero) {
        payload.conductor_documento_numero = record.conductor_documento_numero;
      }
      if (record.conductor_denominacion) {
        payload.conductor_denominacion = record.conductor_denominacion;
      }
      if (record.conductor_nombre) {
        payload.conductor_nombre = record.conductor_nombre;
      }
      if (record.conductor_apellidos) {
        payload.conductor_apellidos = record.conductor_apellidos;
      }
      if (record.conductor_numero_licencia) {
        payload.conductor_numero_licencia = record.conductor_numero_licencia;
      }
    }

    // Campos específicos de GRE Transportista (tipo 8)
    if (record.tipo_de_comprobante === 8) {
      // Conductor obligatorio
      if (record.conductor_documento_tipo) {
        payload.conductor_documento_tipo = String(record.conductor_documento_tipo);
      }
      if (record.conductor_documento_numero) {
        payload.conductor_documento_numero = record.conductor_documento_numero;
      }
      if (record.conductor_denominacion) {
        payload.conductor_denominacion = record.conductor_denominacion;
      }
      if (record.conductor_nombre) {
        payload.conductor_nombre = record.conductor_nombre;
      }
      if (record.conductor_apellidos) {
        payload.conductor_apellidos = record.conductor_apellidos;
      }
      if (record.conductor_numero_licencia) {
        payload.conductor_numero_licencia = record.conductor_numero_licencia;
      }

      // Destinatario obligatorio
      if (record.destinatario_documento_tipo) {
        payload.destinatario_documento_tipo = String(record.destinatario_documento_tipo);
      }
      if (record.destinatario_documento_numero) {
        payload.destinatario_documento_numero = record.destinatario_documento_numero;
      }
      if (record.destinatario_denominacion) {
        payload.destinatario_denominacion = record.destinatario_denominacion;
      }

      // TUC opcional
      if (record.tuc_vehiculo_principal) {
        payload.tuc_vehiculo_principal = record.tuc_vehiculo_principal;
      }
    }

    // Campos condicionales adicionales
    if (record.documento_relacionado_codigo) {
      payload.documento_relacionado_codigo = record.documento_relacionado_codigo;
    }

    if (record.sunat_envio_indicador) {
      payload.sunat_envio_indicador = record.sunat_envio_indicador;

      if (record.sunat_envio_indicador === '02') {
        if (record.subcontratador_documento_tipo) payload.subcontratador_documento_tipo = record.subcontratador_documento_tipo;
        if (record.subcontratador_documento_numero) payload.subcontratador_documento_numero = record.subcontratador_documento_numero;
        if (record.subcontratador_denominacion) payload.subcontratador_denominacion = record.subcontratador_denominacion;
      }

      if (record.sunat_envio_indicador === '03') {
        if (record.pagador_servicio_documento_tipo_identidad) payload.pagador_servicio_documento_tipo_identidad = record.pagador_servicio_documento_tipo_identidad;
        if (record.pagador_servicio_documento_numero_identidad) payload.pagador_servicio_documento_numero_identidad = record.pagador_servicio_documento_numero_identidad;
        if (record.pagador_servicio_denominacion) payload.pagador_servicio_denominacion = record.pagador_servicio_denominacion;
      }
    }

    // Códigos de establecimiento
    if (['04', '18'].includes(record.motivo_de_traslado)) {
      if (record.punto_de_partida_codigo_establecimiento_sunat) {
        payload.punto_de_partida_codigo_establecimiento_sunat = record.punto_de_partida_codigo_establecimiento_sunat;
      }
      if (record.punto_de_llegada_codigo_establecimiento_sunat) {
        payload.punto_de_llegada_codigo_establecimiento_sunat = record.punto_de_llegada_codigo_establecimiento_sunat;
      }
    }

    // ✅ NUEVO: Usar items reales del registro (con código)
    console.log(`\n🔍 [TRANSFORM-RECORD] record.id_guia: ${record.id_guia}`);
    console.log(`🔍 [TRANSFORM-RECORD] record.items (raw):`, record.items);

    if (record.items) {
      try {
        const itemsArray = JSON.parse(record.items);
        console.log(`🔍 [TRANSFORM-RECORD] itemsArray parsed:`, itemsArray);

        if (Array.isArray(itemsArray) && itemsArray.length > 0) {
          payload.items = itemsArray;
          console.log('✅ [PROGRAMACION-SERVICE] Items con código cargados:', itemsArray);
        } else {
          // Fallback si no hay items válidos
          console.warn('⚠️ [PROGRAMACION-SERVICE] Items vacío o inválido, usando fallback');
          payload.items = [
            {
              unidad_de_medida: 'NIU',
              descripcion: 'MATERIAL DE CONSTRUCCION',
              cantidad: '1',
              codigo: 'PROD001' // Código por defecto
            }
          ];
        }
      } catch (e) {
        console.error('❌ [PROGRAMACION-SERVICE] Error parseando items:', e);
        // Fallback en caso de error
        payload.items = [
          {
            unidad_de_medida: 'NIU',
            descripcion: 'MATERIAL DE CONSTRUCCION',
            cantidad: '1',
            codigo: 'PROD001' // Código por defecto
          }
        ];
      }
    } else {
      // Fallback si no existe el campo items
      console.warn('⚠️ [PROGRAMACION-SERVICE] Campo items no existe en el registro, usando fallback');
      payload.items = [
        {
          unidad_de_medida: 'NIU',
          descripcion: 'MATERIAL DE CONSTRUCCION',
          cantidad: '1',
          codigo: 'PROD001' // Código por defecto
        }
      ];
    }

    console.log('📤 [PROGRAMACION-SERVICE] Payload FINAL para Kafka/Nubefact:');
    console.log('   - fecha_de_emision:', payload.fecha_de_emision);
    console.log('   - fecha_de_inicio_de_traslado:', payload.fecha_de_inicio_de_traslado);
    console.log('   - items:', JSON.stringify(payload.items, null, 2));

    return payload;
  }

  // ========== FIN PROGRAMACIÓN EXTENDIDA ==========
}
