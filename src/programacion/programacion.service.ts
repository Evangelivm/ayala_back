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
import { Prisma } from '@generated/prisma';
import { generarIdentificadorAleatorio } from '../utils/codigo-generator';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

// Configurar plugins de dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class ProgramacionService {
  private readonly logger = new Logger(ProgramacionService.name);

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
          MAX(gr.enlace_del_pdf) as enlace_del_pdf,
          MAX(gr.enlace_del_xml) as enlace_del_xml,
          MAX(gr.enlace_del_cdr) as enlace_del_cdr,
          MAX(gr.estado_gre) as estado_gre,
          MAX(gr.duplicado_origen_id) as duplicado_origen_id,
          MAX(gr.duplicado_fecha) as duplicado_fecha,
          MAX(gr.duplicado_lote_id) as duplicado_lote_id,
          MAX(p.nombre) as nombre_proyecto,
          MAX(sp.nombre) as nombre_subproyecto
        FROM programacion_tecnica pt
        LEFT JOIN camiones c ON pt.unidad = c.id_camion
        LEFT JOIN empresas_2025 e ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
        LEFT JOIN guia_remision gr ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
          AND (gr.duplicado_origen_id IS NULL OR gr.duplicado_origen_id = 0)
        LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
        LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
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
        LEFT JOIN guia_remision gr ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
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

      // Obtener guía original de programacion_tecnica
      const guiaOriginal = await this.prisma.programacion_tecnica.findUnique({
        where: { id: idGuiaOriginal },
      });

      if (!guiaOriginal) {
        throw new BadRequestException('Guía original no encontrada');
      }

      // Verificar si tiene guía de remisión
      const guiaRemisionOriginal = await this.prisma.guia_remision.findFirst({
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

      // Generar ID único para el lote
      const loteId = `LOTE-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const fechaDuplicacion = new Date();

      // Crear duplicados en transacción
      const duplicados = await this.prisma.$transaction(async (tx) => {
        const duplicadosCreados: any[] = [];

        for (let i = 0; i < cantidad; i++) {
          // Aplicar modificaciones si las hay
          const modificacion = modificaciones && modificaciones[i] ? modificaciones[i] : {};

          // Generar identificador único para el duplicado (10 caracteres alfanuméricos)
          const nuevoIdentificadorUnico = generarIdentificadorAleatorio();

          // Crear duplicado en programacion_tecnica
          const duplicadoProgramacion = await tx.programacion_tecnica.create({
            data: {
              fecha: guiaOriginal.fecha,
              unidad: guiaOriginal.unidad,
              proveedor: guiaOriginal.proveedor,
              programacion: guiaOriginal.programacion,
              hora_partida: modificacion.hora_partida
                ? new Date(`1970-01-01T${modificacion.hora_partida}`)
                : guiaOriginal.hora_partida,
              estado_programacion: guiaOriginal.estado_programacion,
              comentarios: guiaOriginal.comentarios,
              validacion: guiaOriginal.validacion,
              identificador_unico: nuevoIdentificadorUnico,
              km_del_dia: guiaOriginal.km_del_dia,
              mes: guiaOriginal.mes,
              num_semana: guiaOriginal.num_semana,
              m3: modificacion.m3 || guiaOriginal.m3,
              cantidad_viaje: modificacion.cantidad_viaje || guiaOriginal.cantidad_viaje,
              punto_llegada_direccion: guiaOriginal.punto_llegada_direccion,
              punto_llegada_ubigeo: guiaOriginal.punto_llegada_ubigeo,
              punto_partida_direccion: guiaOriginal.punto_partida_direccion,
              punto_partida_ubigeo: guiaOriginal.punto_partida_ubigeo,
              hora_registro: new Date(),
              id_proyecto: guiaOriginal.id_proyecto,
              id_subproyecto: guiaOriginal.id_subproyecto,
              id_etapa: guiaOriginal.id_etapa,
              id_sector: guiaOriginal.id_sector,
              id_frente: guiaOriginal.id_frente,
              id_partida: guiaOriginal.id_partida,
              id_subetapa: guiaOriginal.id_subetapa,
              id_subsector: guiaOriginal.id_subsector,
              id_subfrente: guiaOriginal.id_subfrente,
              id_subpartida: guiaOriginal.id_subpartida,
            },
          });

          // Crear entrada en guia_remision para el duplicado
          if (guiaRemisionOriginal) {
            // Si la original tiene guía de remisión, copiar datos
            await tx.guia_remision.create({
              data: {
                operacion: guiaRemisionOriginal.operacion,
                tipo_de_comprobante: guiaRemisionOriginal.tipo_de_comprobante,
                serie: guiaRemisionOriginal.serie,
                numero: guiaRemisionOriginal.numero + i + 1, // Incrementar número
                cliente_tipo_de_documento: guiaRemisionOriginal.cliente_tipo_de_documento,
                cliente_numero_de_documento: guiaRemisionOriginal.cliente_numero_de_documento,
                cliente_denominacion: guiaRemisionOriginal.cliente_denominacion,
                cliente_direccion: guiaRemisionOriginal.cliente_direccion,
                fecha_de_emision: guiaRemisionOriginal.fecha_de_emision,
                peso_bruto_total: guiaRemisionOriginal.peso_bruto_total,
                peso_bruto_unidad_de_medida: guiaRemisionOriginal.peso_bruto_unidad_de_medida,
                tipo_de_transporte: guiaRemisionOriginal.tipo_de_transporte,
                fecha_de_inicio_de_traslado: guiaRemisionOriginal.fecha_de_inicio_de_traslado,
                transportista_placa_numero: guiaRemisionOriginal.transportista_placa_numero,
                punto_de_partida_ubigeo: guiaRemisionOriginal.punto_de_partida_ubigeo,
                punto_de_partida_direccion: guiaRemisionOriginal.punto_de_partida_direccion,
                punto_de_llegada_ubigeo: guiaRemisionOriginal.punto_de_llegada_ubigeo,
                punto_de_llegada_direccion: guiaRemisionOriginal.punto_de_llegada_direccion,
                identificador_unico: nuevoIdentificadorUnico,
                duplicado_origen_id: guiaRemisionOriginal.id_guia,
                duplicado_fecha: fechaDuplicacion,
                duplicado_lote_id: loteId,
                id_proyecto: guiaOriginal.id_proyecto,
                id_subproyecto: guiaOriginal.id_subproyecto,
              },
            });
          } else {
            // Si no tiene guía de remisión, crear entrada básica
            await tx.guia_remision.create({
              data: {
                operacion: '0101',
                tipo_de_comprobante: 9,
                serie: 'T001',
                numero: (Date.now() % 999999999) + i,
                cliente_tipo_de_documento: 6,
                cliente_numero_de_documento: '00000000000',
                cliente_denominacion: 'CLIENTE GENERICO',
                cliente_direccion: 'DIRECCION GENERICA',
                fecha_de_emision: new Date(),
                peso_bruto_total: 0,
                peso_bruto_unidad_de_medida: 'TNE',
                transportista_placa_numero: 'AAA000',
                punto_de_partida_ubigeo: '150101',
                punto_de_partida_direccion: 'DIRECCION PARTIDA',
                punto_de_llegada_ubigeo: '150101',
                punto_de_llegada_direccion: 'DIRECCION LLEGADA',
                fecha_de_inicio_de_traslado: new Date(),
                identificador_unico: nuevoIdentificadorUnico,
                duplicado_origen_id: idGuiaOriginal,
                duplicado_fecha: fechaDuplicacion,
                duplicado_lote_id: loteId,
              },
            });
          }

          duplicadosCreados.push(duplicadoProgramacion);
        }

        return duplicadosCreados;
      });

      // Obtener duplicados con datos completos para retornar
      const duplicadosCompletos = await this.prisma.$queryRaw<any[]>`
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
        LEFT JOIN guia_remision gr ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
        LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
        LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
        WHERE gr.duplicado_lote_id = ${loteId}
        ORDER BY pt.id
      `;

      const dataMapped = duplicadosCompletos.map(pt => this.mapProgramacionTecnicaData(pt));

      this.logger.log(`Se crearon ${cantidad} duplicados con lote ${loteId}`);

      return {
        success: true,
        message: `Se crearon ${cantidad} duplicados exitosamente`,
        loteId,
        duplicados: dataMapped,
      };
    } catch (error) {
      this.logger.error('Error al duplicar guía:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al duplicar la guía');
    }
  }

  async enviarDuplicadosKafka(loteId: string, idsGuias: number[]) {
    try {
      // Por ahora, simplemente marcamos como procesados
      // En producción, aquí se enviaría a Kafka
      this.logger.log(`Procesando ${idsGuias.length} guías del lote ${loteId}`);

      let procesados = 0;
      const errores: Array<{ id: number; error: string }> = [];

      for (const idGuia of idsGuias) {
        try {
          // Verificar que la guía exista
          const guia = await this.prisma.programacion_tecnica.findUnique({
            where: { id: idGuia },
          });

          if (!guia) {
            errores.push({
              id: idGuia,
              error: 'Guía no encontrada',
            });
            continue;
          }

          // Verificar que pertenezca al lote
          const guiaRemision = await this.prisma.guia_remision.findFirst({
            where: {
              identificador_unico: guia.identificador_unico,
              duplicado_lote_id: loteId,
            },
          });

          if (!guiaRemision) {
            errores.push({
              id: idGuia,
              error: 'Guía no pertenece al lote especificado',
            });
            continue;
          }

          // TODO: Aquí se enviaría a Kafka
          // await this.kafkaService.send('guias-topic', { guia, guiaRemision });

          procesados++;
        } catch (error) {
          this.logger.error(`Error procesando guía ${idGuia}:`, error);
          errores.push({
            id: idGuia,
            error: error.message,
          });
        }
      }

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
      const guiasConArchivos = await this.prisma.guia_remision.count({
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

      // Obtener identificadores únicos de las guías a eliminar
      const guiasAEliminar = await this.prisma.guia_remision.findMany({
        where: { duplicado_lote_id: loteId },
        select: { identificador_unico: true },
      });

      // Filtrar identificadores nulos y convertir a array de strings
      const identificadores = guiasAEliminar
        .map((g) => g.identificador_unico)
        .filter((id): id is string => id !== null);

      // Eliminar en transacción
      await this.prisma.$transaction(async (tx) => {
        // Eliminar de guia_remision
        await tx.guia_remision.deleteMany({
          where: { duplicado_lote_id: loteId },
        });

        // Eliminar de programacion_tecnica
        if (identificadores.length > 0) {
          await tx.programacion_tecnica.deleteMany({
            where: {
              identificador_unico: { in: identificadores },
            },
          });
        }
      });

      this.logger.log(
        `Se eliminaron ${identificadores.length} duplicados del lote ${loteId}`,
      );

      return {
        success: true,
        message: `Se eliminaron ${identificadores.length} duplicados del lote ${loteId}`,
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
    };
  }

  // ========== FIN PROGRAMACIÓN EXTENDIDA ==========
}
