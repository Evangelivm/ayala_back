import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  type CreateProgramacionDto,
  type ProgramacionItemDto,
  type ProgramacionResponseDto,
} from '../dto/programacion.dto';
import { Prisma } from '@generated/prisma';
import { generarIdentificadorAleatorio } from '../utils/codigo-generator';
import { SearchService } from '../search/search.service';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as ExcelJS from 'exceljs';

// Configurar plugins de dayjs
dayjs.extend(utc as any);
dayjs.extend(timezone as any);

@Injectable()
export class ProgramacionService {
  private readonly logger = new Logger(ProgramacionService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private readonly searchService?: SearchService,
  ) {}

  // Función helper para capitalizar cada palabra
  private capitalizeWords(text: string | null): string | null {
    if (!text) return null;
    return text
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
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
        numero_orden: item.numero_orden || null,
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
          const programacionTecnicaData = data.map(
            (item: ProgramacionItemDto, index: number) => ({
              fecha: programacionData[index].fecha,
              unidad: programacionData[index].unidad,
              proveedor: programacionData[index].proveedor,
              programacion: programacionData[index].programacion,
              hora_partida: programacionData[index].hora_partida,
              estado_programacion: programacionData[index].estado_programacion,
              comentarios: programacionData[index].comentarios,
              identificador_unico: programacionData[index].identificador_unico,
              m3: programacionData[index].peso, // Mapear peso a m3 (ambos son Decimal)
              punto_llegada_direccion:
                programacionData[index].punto_llegada_direccion,
              punto_llegada_ubigeo:
                programacionData[index].punto_llegada_ubigeo,
              punto_partida_direccion:
                programacionData[index].punto_partida_direccion,
              punto_partida_ubigeo:
                programacionData[index].punto_partida_ubigeo,
              hora_registro: programacionData[index].hora_registro, // Registrar la misma fecha y hora
              id_proyecto: item.id_proyecto || null, // Incluir id_proyecto si está presente
              id_subproyecto: item.id_subproyecto || null, // Incluir id_subproyecto si está presente
              numero_orden: item.numero_orden || null,
            }),
          );

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

      // Indexar nuevos registros en Elasticsearch (fire-and-forget)
      if (this.searchService) {
        const identifUnicos = programacionData
          .map((p) => p.identificador_unico)
          .filter(Boolean);
        if (identifUnicos.length > 0) {
          const newRecords = await this.prisma.$queryRaw<any[]>(
            Prisma.sql`
              SELECT pt.id, pt.fecha, pt.identificador_unico, pt.estado_programacion,
                     pt.programacion, pt.m3,
                     c.placa AS unidad_placa, c.nombre_chofer, c.apellido_chofer,
                     e.razon_social AS empresa_razon_social,
                     p.nombre AS nombre_proyecto,
                     sp.nombre AS nombre_subproyecto
              FROM programacion_tecnica pt
              LEFT JOIN camiones c ON pt.unidad = c.id_camion
              LEFT JOIN empresas_2025 e
                     ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
              LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
              LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
              WHERE pt.identificador_unico IN (${Prisma.join(identifUnicos)})
            `,
          );
          const capitalize = (s: string | null) =>
            s
              ? s
                  .toLowerCase()
                  .split(' ')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ')
              : null;
          for (const r of newRecords) {
            const apellidos_nombres =
              [capitalize(r.nombre_chofer), capitalize(r.apellido_chofer)]
                .filter(Boolean)
                .join(' ') || null;
            const fechaStr = r.fecha
              ? dayjs(r.fecha).format('YYYY-MM-DD')
              : null;
            this.searchService.indexDoc(
              'programacion_tecnica',
              r.id.toString(),
              {
                id: r.id,
                fecha: fechaStr,
                fecha_str: fechaStr,
                proveedor: r.empresa_razon_social || null,
                apellidos_nombres,
                proyectos: r.nombre_subproyecto || r.nombre_proyecto || null,
                unidad: r.unidad_placa || null,
                programacion: r.programacion || null,
                m3: r.m3 != null ? r.m3.toString() : null,
                identificador_unico: r.identificador_unico,
                estado_programacion: r.estado_programacion,
                deleted_at: null,
              },
            );
          }
        }
      }

      return {
        message:
          'Registros de programación guardados exitosamente en ambas tablas',
        totalRecords: data.length,
        successCount: result.count,
        successCountTecnica: result.countTecnica,
        processingTime,
      };
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
      const tecnica = await this.prisma.programacion_tecnica.findUnique({
        where: { id },
        select: { id: true, identificador_unico: true },
      });

      if (!tecnica) {
        throw new BadRequestException(
          `Registro técnico con ID ${id} no encontrado`,
        );
      }

      const now = new Date();

      await this.prisma.programacion_tecnica.update({
        where: { id },
        data: { deleted_at: now },
      });
      this.logger.log(`Soft delete aplicado a programacion_tecnica ID ${id}`);

      if (tecnica.identificador_unico) {
        await this.prisma.programacion.updateMany({
          where: { identificador_unico: tecnica.identificador_unico },
          data: { deleted_at: now },
        });
      }

      // Actualizar en Elasticsearch (fire-and-forget)
      if (this.searchService) {
        this.searchService.indexDoc('programacion_tecnica', id.toString(), {
          deleted_at: now.toISOString(),
        });
      }

      return { message: 'Registro marcado como eliminado exitosamente' };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(
        `Error al hacer soft delete del registro técnico ID ${id}:`,
        error,
      );
      throw new InternalServerErrorException('Error al eliminar el registro');
    }
  }

  async restoreTecnicaById(id: number) {
    try {
      const tecnica = await this.prisma.programacion_tecnica.findUnique({
        where: { id },
        select: { id: true, identificador_unico: true, deleted_at: true },
      });

      if (!tecnica) {
        throw new BadRequestException(
          `Registro técnico con ID ${id} no encontrado`,
        );
      }

      if (!tecnica.deleted_at) {
        throw new BadRequestException(
          `El registro con ID ${id} no está eliminado`,
        );
      }

      await this.prisma.programacion_tecnica.update({
        where: { id },
        data: { deleted_at: null },
      });

      if (tecnica.identificador_unico) {
        await this.prisma.programacion.updateMany({
          where: { identificador_unico: tecnica.identificador_unico },
          data: { deleted_at: null },
        });
      }

      return { message: 'Registro restaurado exitosamente' };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Error al restaurar registro técnico ID ${id}:`, error);
      throw new InternalServerErrorException('Error al restaurar el registro');
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
        WHERE pt.deleted_at IS NULL
        ORDER BY pt.fecha DESC
      `;

      // Mapear los resultados al formato esperado por el frontend
      const data = programacionTecnica.map((pt) => {
        // Capitalizar nombre y apellido por separado, luego concatenar
        const nombreCapitalizado = this.capitalizeWords(pt.nombre_chofer);
        const apellidoCapitalizado = this.capitalizeWords(pt.apellido_chofer);
        const nombreCompleto =
          nombreCapitalizado && apellidoCapitalizado
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
            horaPartidaISO = dayjs
              .tz(
                `${fechaStr} ${horaStr}`,
                'YYYY-MM-DD HH:mm:ss',
                'America/Lima',
              )
              .toISOString();
          } catch (error: any) {
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
          deleted_at: pt.deleted_at || null,
          numero_orden: pt.numero_orden || null,
        };
      });

      return data;
    } catch (error: any) {
      this.logger.error(
        'Error al obtener registros de programación técnica:',
        error,
      );
      throw new InternalServerErrorException('Error al obtener los registros');
    }
  }

  async findAllProgramacionTecnicaAdmin() {
    try {
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

      const data = programacionTecnica.map((pt) => {
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
              .tz(
                `${fechaStr} ${horaStr}`,
                'YYYY-MM-DD HH:mm:ss',
                'America/Lima',
              )
              .toISOString();
          } catch (error: any) {
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
          deleted_at: pt.deleted_at || null,
        };
      });

      return data;
    } catch (error: any) {
      this.logger.error(
        'Error al obtener registros admin de programación técnica:',
        error,
      );
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
        guia_destinatario_denominacion:
          programacionTecnica.guia_destinatario_denominacion,
        guia_destinatario_direccion:
          programacionTecnica.guia_destinatario_direccion,
        guia_traslado_peso_bruto: programacionTecnica.guia_traslado_peso_bruto,
        guia_traslado_vehiculo_placa:
          programacionTecnica.guia_traslado_vehiculo_placa,
        guia_conductor_dni_numero:
          programacionTecnica.guia_conductor_dni_numero,
        guia_conductor_nombres: programacionTecnica.guia_conductor_nombres,
        guia_conductor_apellidos: programacionTecnica.guia_conductor_apellidos,
        guia_conductor_num_licencia:
          programacionTecnica.guia_conductor_num_licencia,
        punto_partida_ubigeo: programacionTecnica.punto_partida_ubigeo,
        punto_partida_direccion: programacionTecnica.punto_partida_direccion,
        punto_llegada_ubigeo: programacionTecnica.punto_llegada_ubigeo,
        punto_llegada_direccion: programacionTecnica.punto_llegada_direccion,
        // Datos de la unidad (camión)
        camion_placa: programacionTecnica.camion_placa || null,
        camion_dni: programacionTecnica.camion_dni || null,
        camion_nombre_chofer: programacionTecnica.camion_nombre_chofer || null,
        camion_apellido_chofer:
          programacionTecnica.camion_apellido_chofer || null,
        camion_numero_licencia:
          programacionTecnica.camion_numero_licencia || null,
        // Datos del proveedor (empresa)
        empresa_razon_social: programacionTecnica.empresa_razon_social || null,
        empresa_nro_documento:
          programacionTecnica.empresa_nro_documento || null,
        empresa_direccion: programacionTecnica.empresa_direccion || null,
        // Datos del proyecto/subproyecto
        id_proyecto: programacionTecnica.id_proyecto || null,
        id_subproyecto: programacionTecnica.id_subproyecto || null,
        // Enlaces de la guía de remisión (desde Kafka/NUBEFACT)
        enlace_del_pdf: programacionTecnica.enlace_del_pdf || null,
        enlace_del_xml: programacionTecnica.enlace_del_xml || null,
        enlace_del_cdr: programacionTecnica.enlace_del_cdr || null,
      };
    } catch (error: any) {
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
      estado_programacion?: string | null;
      comentarios?: string | null;
      cantidad_viaje?: string | null;
      proveedor?: string | null;
      fecha?: string | null;
      hora_partida?: string | null;
      unidad?: number | null;
      programacion?: string | null;
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

      // Construir objeto de actualización con campos opcionales
      const dataToUpdate: Record<string, unknown> = {
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
      };

      if ('estado_programacion' in updateData)
        dataToUpdate.estado_programacion = updateData.estado_programacion ?? null;
      if ('comentarios' in updateData)
        dataToUpdate.comentarios = updateData.comentarios ?? null;
      if ('cantidad_viaje' in updateData)
        dataToUpdate.cantidad_viaje = updateData.cantidad_viaje ?? null;
      if ('proveedor' in updateData)
        dataToUpdate.proveedor = updateData.proveedor ?? null;
      if ('fecha' in updateData)
        dataToUpdate.fecha = updateData.fecha ? new Date(updateData.fecha) : null;
      if ('hora_partida' in updateData) {
        const hp = updateData.hora_partida;
        if (!hp) {
          dataToUpdate.hora_partida = null;
        } else {
          // Acepta "HH:MM" o "HH:MM:SS"; descarta ISO completos u otros formatos inválidos
          const match = hp.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
          if (match) {
            dataToUpdate.hora_partida = new Date(`1970-01-01T${match[1]}:${match[2]}:00Z`);
          } else {
            this.logger.warn(`hora_partida inválida recibida (ID ${id}): "${hp}" — se ignora`);
            dataToUpdate.hora_partida = null;
          }
        }
      }
      if ('unidad' in updateData)
        dataToUpdate.unidad = updateData.unidad ?? null;
      if ('programacion' in updateData)
        dataToUpdate.programacion = updateData.programacion ?? null;

      // Actualizar el registro con los nuevos valores
      const updatedRecord = await this.prisma.programacion_tecnica.update({
        where: { id },
        data: dataToUpdate as any,
      });

      this.logger.log(
        `Programación técnica con ID ${id} actualizada exitosamente`,
      );

      return {
        message: 'Programación técnica actualizada exitosamente',
        data: updatedRecord,
      };
    } catch (error: any) {
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

  async updateNumeroOrden(id: number, numeroOrden: string | null) {
    const updated = await this.prisma.programacion_tecnica.update({
      where: { id },
      data: { numero_orden: numeroOrden || null },
    });
    return { message: 'numero_orden actualizado', data: updated };
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
        .map((guia) => guia.identificador_unico)
        .filter((id): id is string => id !== null);

      this.logger.log(
        `Encontrados ${identificadores.length} identificadores únicos con guía generada`,
      );

      return identificadores;
    } catch (error: any) {
      this.logger.error(
        'Error al obtener identificadores únicos con guía:',
        error,
      );
      throw new InternalServerErrorException(
        'Error al obtener los identificadores',
      );
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
          AND pt.deleted_at IS NULL
        ORDER BY gr.updated_at DESC
      `;

      // Mapear los resultados al formato esperado por el frontend
      const data = datosCompletos.map((pt) => {
        // Capitalizar nombre y apellido por separado, luego concatenar
        const nombreCapitalizado = this.capitalizeWords(pt.nombre_chofer);
        const apellidoCapitalizado = this.capitalizeWords(pt.apellido_chofer);
        const nombreCompleto =
          nombreCapitalizado && apellidoCapitalizado
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
            horaPartidaISO = dayjs
              .tz(
                `${fechaStr} ${horaStr}`,
                'YYYY-MM-DD HH:mm:ss',
                'America/Lima',
              )
              .toISOString();
          } catch (error: any) {
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
          numero_orden: pt.numero_orden || null,
        };
      });

      this.logger.log(
        `Encontrados ${data.length} registros recién completados en los últimos ${segundos} segundos`,
      );

      return data;
    } catch (error: any) {
      this.logger.error(
        'Error al obtener registros recién completados:',
        error,
      );
      throw new InternalServerErrorException(
        'Error al obtener los registros recién completados',
      );
    }
  }


  async saveBackendLogs(id: number, logs: string): Promise<void> {
    await this.prisma.programacion_tecnica.update({
      where: { id },
      data: { backend_logs: logs },
    });
  }

  async exportarExcel(filtros: {
    proveedores?: string[];
    unidades?: string[];
    fechaDesde?: string;
    fechaHasta?: string;
  }): Promise<Buffer> {
    const filterProveedores =
      filtros.proveedores && filtros.proveedores.length > 0
        ? Prisma.sql`AND e.razon_social IN (${Prisma.join(filtros.proveedores)})`
        : Prisma.empty;

    const filterUnidades =
      filtros.unidades && filtros.unidades.length > 0
        ? Prisma.sql`AND c.placa IN (${Prisma.join(filtros.unidades)})`
        : Prisma.empty;

    const filterFechaDesde = filtros.fechaDesde
      ? Prisma.sql`AND pt.fecha >= ${new Date(filtros.fechaDesde)}`
      : Prisma.empty;

    const filterFechaHasta = filtros.fechaHasta
      ? Prisma.sql`AND pt.fecha <= ${new Date(filtros.fechaHasta + 'T23:59:59')}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        pt.id,
        pt.fecha,
        pt.hora_partida,
        pt.programacion,
        pt.estado_programacion,
        pt.m3,
        pt.cantidad_viaje,
        pt.numero_orden,
        c.placa AS unidad,
        c.nombre_chofer,
        c.apellido_chofer,
        e.razon_social AS proveedor,
        COALESCE(sp.nombre, p.nombre) AS proyecto,
        CASE WHEN sp.id_subproyecto IS NOT NULL THEN 'Subproyecto' ELSE 'Proyecto' END AS tipo_proyecto,
        gr.enlace_del_pdf
      FROM programacion_tecnica pt
      LEFT JOIN camiones c ON pt.unidad = c.id_camion
      LEFT JOIN empresas_2025 e ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
      LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
      LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
      LEFT JOIN guia_remision gr ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
        AND gr.estado_gre = 'COMPLETADO'
      WHERE pt.deleted_at IS NULL
      ${filterProveedores}
      ${filterUnidades}
      ${filterFechaDesde}
      ${filterFechaHasta}
      ORDER BY pt.fecha DESC, pt.id DESC
    `);

    const capitalizar = (texto: string | null) => {
      if (!texto) return '';
      return texto
        .toLowerCase()
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    };

    const COLOR_HEADER_BG = 'FFEA580C'; // naranja brand
    const COLOR_HEADER_FG = 'FFFFFFFF';
    const COLOR_ROW_ALT = 'FFFFF7ED'; // naranja muy claro
    const COLOR_ROW_BASE = 'FFFFFFFF';
    const COLOR_OK_FG = 'FF15803D';
    const COLOR_NO_FG = 'FFB91C1C';
    const COLOR_PDF_FG = 'FFB91C1C';
    const COLOR_BORDER = 'FFD1D5DB';

    const borderThin: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: COLOR_BORDER } },
      left: { style: 'thin', color: { argb: COLOR_BORDER } },
      bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
      right: { style: 'thin', color: { argb: COLOR_BORDER } },
    };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Ayala Sistema';
    const ws = wb.addWorksheet('Programación', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Fecha', key: 'fecha', width: 13 },
      { header: 'Unidad', key: 'unidad', width: 13 },
      { header: 'Proveedor', key: 'proveedor', width: 32 },
      { header: 'Apellidos y Nombres', key: 'conductor', width: 26 },
      { header: 'Proyectos', key: 'proyecto', width: 26 },
      { header: 'Programación', key: 'programacion', width: 16 },
      { header: 'H.P', key: 'hp', width: 9 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'M3', key: 'm3', width: 8 },
      { header: 'Cant. Viaje', key: 'cant_viaje', width: 12 },
      { header: 'Link PDF', key: 'pdf', width: 10 },
      { header: 'Viaje Activado', key: 'viaje', width: 14 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR_HEADER_BG },
      };
      cell.font = { bold: true, color: { argb: COLOR_HEADER_FG }, size: 10 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: false,
      };
      cell.border = borderThin;
    });

    rows.forEach((row, idx) => {
      const fecha = row.fecha ? dayjs(row.fecha).format('DD/MM/YYYY') : '';
      const hora = row.hora_partida
        ? dayjs(row.hora_partida).format('HH:mm')
        : '';
      const conductor = [
        capitalizar(row.nombre_chofer),
        capitalizar(row.apellido_chofer),
      ]
        .filter(Boolean)
        .join(' ');
      const viajeActivado = row.numero_orden ? 'Sí' : 'No';
      const bgColor = idx % 2 === 0 ? COLOR_ROW_BASE : COLOR_ROW_ALT;

      const excelRow = ws.addRow({
        id: Number(row.id),
        fecha,
        unidad: row.unidad || '',
        proveedor: row.proveedor || '',
        conductor,
        proyecto: row.proyecto || '',
        programacion: row.programacion || '',
        hp: hora,
        estado: row.estado_programacion || '',
        m3: row.m3 != null ? row.m3.toString() : '',
        cant_viaje:
          row.cantidad_viaje != null ? Number(row.cantidad_viaje) : '',
        pdf: '',
        viaje: viajeActivado,
      });

      excelRow.height = 18;
      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.font = { size: 9 };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = borderThin;
      });

      const estadoCell = excelRow.getCell('estado');
      if (row.estado_programacion === 'OK') {
        estadoCell.font = { size: 9, bold: true, color: { argb: COLOR_OK_FG } };
      } else if (row.estado_programacion === 'NO EJECUTADO') {
        estadoCell.font = { size: 9, bold: true, color: { argb: COLOR_NO_FG } };
      }

      const viajeCell = excelRow.getCell('viaje');
      viajeCell.font = {
        size: 9,
        bold: viajeActivado === 'Sí',
        color: { argb: viajeActivado === 'Sí' ? 'FFEA580C' : 'FF6B7280' },
      };
      viajeCell.alignment = { vertical: 'middle', horizontal: 'center' };

      if (row.enlace_del_pdf) {
        const pdfCell = excelRow.getCell('pdf');
        pdfCell.value = { text: 'PDF', hyperlink: row.enlace_del_pdf };
        pdfCell.font = {
          size: 9,
          bold: true,
          underline: true,
          color: { argb: COLOR_PDF_FG },
        };
        pdfCell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });

    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  async exportarExcelMixto(filtros: {
    proveedores?: string[];
    fechaDesde?: string;
    fechaHasta?: string;
  }): Promise<Buffer> {
    const filterProveedores =
      filtros.proveedores && filtros.proveedores.length > 0
        ? Prisma.sql`AND e.razon_social IN (${Prisma.join(filtros.proveedores)})`
        : Prisma.empty;

    const filterFechaDesde = filtros.fechaDesde
      ? Prisma.sql`AND pt.fecha >= ${new Date(filtros.fechaDesde)}`
      : Prisma.empty;

    const filterFechaHasta = filtros.fechaHasta
      ? Prisma.sql`AND pt.fecha <= ${new Date(filtros.fechaHasta + 'T23:59:59')}`
      : Prisma.empty;

    // Hoja única: une ambas tablas de guías (TTT1 y TTT2) en una sola consulta
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        pt.id,
        pt.fecha,
        pt.hora_partida,
        pt.programacion,
        pt.estado_programacion,
        pt.m3,
        pt.cantidad_viaje,
        pt.numero_orden,
        pt.identificador_unico,
        pt.punto_partida_ubigeo,
        pt.punto_partida_direccion,
        pt.punto_llegada_ubigeo,
        pt.punto_llegada_direccion,
        c.placa AS unidad,
        c.nombre_chofer,
        c.apellido_chofer,
        e.razon_social AS proveedor,
        COALESCE(sp.nombre, p.nombre) AS proyecto,
        CASE WHEN sp.id_subproyecto IS NOT NULL THEN 'Subproyecto' ELSE 'Proyecto' END AS tipo_proyecto,
        gr.serie AS serie_ttt1,
        gr.numero AS numero_ttt1,
        gr.estado_gre AS estado_ttt1,
        gr.enlace_del_pdf AS pdf_ttt1,
        gre.serie AS serie_ttt2,
        gre.numero AS numero_ttt2,
        gre.estado_gre,
        gre.enlace_del_pdf AS pdf_ttt2,
        gre.enlace_del_xml,
        gre.enlace_del_cdr
      FROM programacion_tecnica pt
      LEFT JOIN camiones c ON pt.unidad = c.id_camion
      LEFT JOIN empresas_2025 e ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
      LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
      LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
      LEFT JOIN guia_remision gr
        ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
        AND gr.estado_gre = 'COMPLETADO'
      LEFT JOIN guia_remision_extendida gre
        ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gre.identificador_unico COLLATE utf8mb4_unicode_ci
      WHERE pt.deleted_at IS NULL
      ${filterProveedores}
      ${filterFechaDesde}
      ${filterFechaHasta}
      ORDER BY pt.fecha DESC, pt.id DESC, gre.numero ASC
    `);

    const capitalizar = (texto: string | null) => {
      if (!texto) return '';
      return texto
        .toLowerCase()
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    };

    const COLOR_BORDER = 'FFD1D5DB';
    const borderThin: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: COLOR_BORDER } },
      left: { style: 'thin', color: { argb: COLOR_BORDER } },
      bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
      right: { style: 'thin', color: { argb: COLOR_BORDER } },
    };

    const COLOR_HDR_BG = 'FFEA580C';
    const COLOR_HDR_FG = 'FFFFFFFF';
    const COLOR_ROW_BASE = 'FFFFFFFF';
    const COLOR_ROW_ALT = 'FFFFF7ED';
    const COLOR_GUIA_BG = 'FFD1FAE5';
    const COLOR_OK_FG = 'FF15803D';
    const COLOR_NO_FG = 'FFB91C1C';
    const COLOR_PDF_FG = 'FFB91C1C';
    const COLOR_XML_FG = 'FF15803D';
    const COLOR_CDR_FG = 'FF1D4ED8';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Ayala Sistema';

    const ws = wb.addWorksheet('Programación Mixta', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Fecha', key: 'fecha', width: 13 },
      { header: 'Hora', key: 'hora', width: 8 },
      { header: 'Unidad', key: 'unidad', width: 13 },
      { header: 'Proveedor', key: 'proveedor', width: 32 },
      { header: 'Conductor', key: 'conductor', width: 26 },
      { header: 'Proyecto', key: 'proyecto', width: 26 },
      { header: 'Tipo', key: 'tipo', width: 13 },
      { header: 'Programación', key: 'programacion', width: 16 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'M3', key: 'm3', width: 8 },
      { header: 'Cant. Viaje', key: 'cant_viaje', width: 12 },
      { header: 'Identificador', key: 'identificador', width: 22 },
      { header: 'P. Partida Ubig.', key: 'partida_ubigeo', width: 17 },
      { header: 'P. Partida Dir.', key: 'partida_dir', width: 30 },
      { header: 'P. Llegada Ubig.', key: 'llegada_ubigeo', width: 17 },
      { header: 'P. Llegada Dir.', key: 'llegada_dir', width: 30 },
      { header: 'PDF Técnica', key: 'pdf_tec', width: 12 },
      { header: 'N° Guía', key: 'nro_guia', width: 20 },
      { header: 'Estado Guía', key: 'estado_guia', width: 28 },
      { header: 'PDF Ext.', key: 'pdf_ext', width: 10 },
      { header: 'XML Ext.', key: 'xml_ext', width: 10 },
      { header: 'CDR Ext.', key: 'cdr_ext', width: 10 },
      { header: 'Viaje Activado', key: 'viaje', width: 14 },
    ];

    const hRow = ws.getRow(1);
    hRow.height = 22;
    hRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR_HDR_BG },
      };
      cell.font = { bold: true, color: { argb: COLOR_HDR_FG }, size: 10 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: false,
      };
      cell.border = borderThin;
    });

    rows.forEach((row, idx) => {
      const fecha = row.fecha ? dayjs(row.fecha).format('DD/MM/YYYY') : '';
      const hora = row.hora_partida
        ? dayjs(row.hora_partida).format('HH:mm')
        : '';
      const conductor = [
        capitalizar(row.nombre_chofer),
        capitalizar(row.apellido_chofer),
      ]
        .filter(Boolean)
        .join(' ');
      const viajeActivado = row.numero_orden ? 'Sí' : 'No';
      const nroTtt1 =
        row.serie_ttt1 && row.numero_ttt1 != null
          ? `${row.serie_ttt1}-${String(row.numero_ttt1).padStart(4, '0')}`
          : '';
      const nroTtt2 =
        row.serie_ttt2 && row.numero_ttt2 != null
          ? `${row.serie_ttt2}-${String(row.numero_ttt2).padStart(4, '0')}`
          : '';
      const numeroGuia = [nroTtt1, nroTtt2].filter(Boolean).join(' / ');
      const estadoTtt1 = row.estado_ttt1 ? `TTT1: ${row.estado_ttt1}` : '';
      const estadoTtt2 = row.estado_gre ? `TTT2: ${row.estado_gre}` : '';
      const estadoGuia = [estadoTtt1, estadoTtt2].filter(Boolean).join(' / ');
      const completada =
        row.pdf_ttt2 && row.enlace_del_xml && row.enlace_del_cdr;
      const bgColor = completada
        ? COLOR_GUIA_BG
        : idx % 2 === 0
          ? COLOR_ROW_BASE
          : COLOR_ROW_ALT;

      const excelRow = ws.addRow({
        id: Number(row.id),
        fecha,
        hora,
        unidad: row.unidad || '',
        proveedor: row.proveedor || '',
        conductor,
        proyecto: row.proyecto || '',
        tipo: row.tipo_proyecto || '',
        programacion: row.programacion || '',
        estado: row.estado_programacion || '',
        m3: row.m3 != null ? row.m3.toString() : '',
        cant_viaje:
          row.cantidad_viaje != null ? Number(row.cantidad_viaje) : '',
        identificador: row.identificador_unico || '',
        partida_ubigeo: row.punto_partida_ubigeo || '',
        partida_dir: row.punto_partida_direccion || '',
        llegada_ubigeo: row.punto_llegada_ubigeo || '',
        llegada_dir: row.punto_llegada_direccion || '',
        pdf_tec: '',
        nro_guia: numeroGuia,
        estado_guia: estadoGuia,
        pdf_ext: '',
        xml_ext: '',
        cdr_ext: '',
        viaje: viajeActivado,
      });

      excelRow.height = 18;
      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.font = { size: 9 };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = borderThin;
      });

      const estadoCell = excelRow.getCell('estado');
      if (row.estado_programacion === 'OK') {
        estadoCell.font = { size: 9, bold: true, color: { argb: COLOR_OK_FG } };
      } else if (row.estado_programacion === 'NO EJECUTADO') {
        estadoCell.font = { size: 9, bold: true, color: { argb: COLOR_NO_FG } };
      }

      const viajeCell = excelRow.getCell('viaje');
      viajeCell.font = {
        size: 9,
        bold: viajeActivado === 'Sí',
        color: { argb: viajeActivado === 'Sí' ? 'FFEA580C' : 'FF6B7280' },
      };
      viajeCell.alignment = { vertical: 'middle', horizontal: 'center' };

      if (numeroGuia) {
        excelRow.getCell('nro_guia').font = {
          size: 9,
          bold: true,
          color: { argb: 'FF374151' },
        };
      }

      if (row.pdf_ttt1) {
        const cell = excelRow.getCell('pdf_tec');
        cell.value = { text: 'PDF', hyperlink: row.pdf_ttt1 };
        cell.font = {
          size: 9,
          bold: true,
          underline: true,
          color: { argb: COLOR_PDF_FG },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      const linkDefs = [
        {
          key: 'pdf_ext',
          url: row.pdf_ttt2,
          label: 'PDF',
          color: COLOR_PDF_FG,
        },
        {
          key: 'xml_ext',
          url: row.enlace_del_xml,
          label: 'XML',
          color: COLOR_XML_FG,
        },
        {
          key: 'cdr_ext',
          url: row.enlace_del_cdr,
          label: 'CDR',
          color: COLOR_CDR_FG,
        },
      ] as const;

      for (const { key, url, label, color } of linkDefs) {
        if (url) {
          const cell = excelRow.getCell(key);
          cell.value = { text: label, hyperlink: url };
          cell.font = {
            size: 9,
            bold: true,
            underline: true,
            color: { argb: color },
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      }
    });

    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }
}
