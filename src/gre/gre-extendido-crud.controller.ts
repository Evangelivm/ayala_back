import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
  Res,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { Response } from 'express';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as archiver from 'archiver';
import axios from 'axios';
import { Prisma } from '@generated/prisma';
import * as ExcelJS from 'exceljs';

// Extender dayjs con plugins
dayjs.extend(utc);
dayjs.extend(timezone);

@Controller('guias-remision-extendido')
export class GreExtendidoCrudController {
  private readonly logger = new Logger(GreExtendidoCrudController.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  /**
   * Obtener identificadores únicos que ya tienen guías en esta tabla
   */
  @Get('identificadores-existentes')
  async getIdentificadoresExistentes() {
    try {
      const guias = await this.prismaService.guia_remision_extendida.findMany({
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

      const identificadores = guias
        .map((g) => g.identificador_unico)
        .filter((id) => id !== null);

      return identificadores;
    } catch (error) {
      this.logger.error('Error obteniendo identificadores existentes:', error);
      throw new HttpException(
        'Error obteniendo identificadores existentes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener el último número de guía registrado
   */
  @Get('ultimo-numero')
  async getLastNumber() {
    try {
      const lastGuia =
        await this.prismaService.guia_remision_extendida.findFirst({
          orderBy: {
            numero: 'desc',
          },
          select: {
            numero: true,
          },
        });

      return {
        numero: lastGuia ? lastGuia.numero : 0,
      };
    } catch (error) {
      this.logger.error('Error obteniendo último número:', error);
      throw new HttpException(
        'Error obteniendo último número de guía extendida',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener guías por identificador único (para mostrar todas las duplicaciones de un registro)
   */
  @Get('by-identificador/:identificador')
  async getByIdentificador(@Param('identificador') identificador: string) {
    try {
      const guias = await this.prismaService.guia_remision_extendida.findMany({
        where: {
          identificador_unico: identificador,
          // Mostrar TODAS las guías sin importar el estado
        },
        select: {
          id_guia: true,
          serie: true,
          numero: true,
          enlace_del_pdf: true,
          enlace_del_xml: true,
          enlace_del_cdr: true,
          created_at: true,
          estado_gre: true,
        },
        orderBy: {
          numero: 'asc', // Ordenar por número de guía
        },
      });

      return guias;
    } catch (error) {
      this.logger.error(
        `Error obteniendo guías por identificador ${identificador}:`,
        error,
      );
      throw new HttpException(
        'Error obteniendo guías extendidas por identificador',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener todas las guías con paginación y filtros
   */
  @Get()
  async getAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('fecha_desde') fechaDesde?: string,
    @Query('fecha_hasta') fechaHasta?: string,
    @Query('id_proyecto') idProyecto?: string,
    @Query('estado_gre') estadoGre?: string,
    @Query('serie') serie?: string,
  ) {
    try {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Construir filtros
      const where: any = {};

      if (fechaDesde || fechaHasta) {
        where.fecha_de_emision = {};
        if (fechaDesde) where.fecha_de_emision.gte = new Date(fechaDesde);
        if (fechaHasta) where.fecha_de_emision.lte = new Date(fechaHasta);
      }

      if (idProyecto) where.id_proyecto = parseInt(idProyecto);
      if (estadoGre) where.estado_gre = estadoGre;
      if (serie) where.serie = serie;

      // Obtener datos con relaciones
      const [guias, total] = await Promise.all([
        this.prismaService.guia_remision_extendida.findMany({
          where,
          skip,
          take: limitNum,
          include: {
            items_extendida: true,
            documento_relacionado_extendida: true,
            proyecto: {
              select: {
                id_proyecto: true,
                nombre: true,
              },
            },
            etapas: {
              select: {
                id_etapa: true,
                nombre: true,
              },
            },
            sector: {
              select: {
                id_sector: true,
                nombre: true,
              },
            },
            frente: {
              select: {
                id_frente: true,
                nombre: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
        }),
        this.prismaService.guia_remision_extendida.count({ where }),
      ]);

      return {
        data: guias,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      this.logger.error('Error obteniendo guías extendidas:', error);
      throw new HttpException(
        'Error obteniendo guías de remisión extendidas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener una guía por ID
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    try {
      const guia = await this.prismaService.guia_remision_extendida.findUnique({
        where: { id_guia: parseInt(id) },
        include: {
          items_extendida: true,
          documento_relacionado_extendida: true,
          vehiculos_secundarios_extendida: true,
          conductores_secundarios_extendida: true,
          proyecto: true,
          etapas: true,
          sector: true,
          frente: true,
          partida: true,
        },
      });

      if (!guia) {
        throw new HttpException(
          'Guía extendida no encontrada',
          HttpStatus.NOT_FOUND,
        );
      }

      return guia;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error obteniendo guía extendida ${id}:`, error);
      throw new HttpException(
        'Error obteniendo guía de remisión extendida',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Crear nueva guía de remisión extendida
   */
  @Post()
  async create(@Body() data: any) {
    try {
      this.logger.log('Creando nueva guía de remisión extendida (TTT2)');

      // Validar campos obligatorios
      this.validateGreData(data);

      // Extraer items y documentos relacionados
      const {
        items,
        documento_relacionado,
        vehiculos_secundarios,
        conductores_secundarios,
        ...greData
      } = data;

      // Convertir fechas a Date objects en timezone de Perú para evitar desfase de días
      // dayjs.tz() crea la fecha específicamente en timezone de Perú (America/Lima)
      console.log(
        '📅 [CRUD EXTENDIDO] Fecha recibida del frontend:',
        greData.fecha_de_emision,
        greData.fecha_de_inicio_de_traslado,
      );

      const fechaEmisionPeru = dayjs
        .tz(greData.fecha_de_emision, 'America/Lima')
        .toDate();
      const fechaInicioPeru = dayjs
        .tz(greData.fecha_de_inicio_de_traslado, 'America/Lima')
        .toDate();

      console.log(
        '📅 [CRUD EXTENDIDO] Fecha emision en Perú:',
        fechaEmisionPeru.toISOString(),
      );
      console.log(
        '📅 [CRUD EXTENDIDO] Fecha inicio en Perú:',
        fechaInicioPeru.toISOString(),
      );

      const formattedData = {
        ...greData,
        fecha_de_emision: fechaEmisionPeru,
        fecha_de_inicio_de_traslado: fechaInicioPeru,
        estado_gre: null, // Estado inicial NULL para que el detector lo procese
      };

      // Crear guía con relaciones
      const guia = await this.prismaService.guia_remision_extendida.create({
        data: {
          ...formattedData,
          items_extendida:
            items && items.length > 0
              ? {
                  create: items.map((item: any, index: number) => ({
                    unidad_de_medida: item.unidad_de_medida,
                    codigo: item.codigo,
                    descripcion: item.descripcion,
                    cantidad: item.cantidad,
                    orden: index + 1,
                  })),
                }
              : undefined,
          documento_relacionado_extendida:
            documento_relacionado && documento_relacionado.length > 0
              ? {
                  create: documento_relacionado.map((doc: any) => ({
                    tipo: doc.tipo,
                    serie: doc.serie,
                    numero: parseInt(doc.numero),
                  })),
                }
              : undefined,
          vehiculos_secundarios_extendida:
            vehiculos_secundarios && vehiculos_secundarios.length > 0
              ? {
                  create: vehiculos_secundarios.map((vehiculo: any) => ({
                    placa_numero: vehiculo.placa_numero,
                    tuc: vehiculo.tuc,
                  })),
                }
              : undefined,
          conductores_secundarios_extendida:
            conductores_secundarios && conductores_secundarios.length > 0
              ? {
                  create: conductores_secundarios.map((conductor: any) => ({
                    documento_tipo: parseInt(conductor.documento_tipo),
                    documento_numero: conductor.documento_numero,
                    nombre: conductor.nombre,
                    apellidos: conductor.apellidos,
                    numero_licencia: conductor.numero_licencia,
                  })),
                }
              : undefined,
        },
        include: {
          items_extendida: true,
          documento_relacionado_extendida: true,
          vehiculos_secundarios_extendida: true,
          conductores_secundarios_extendida: true,
        },
      });

      this.logger.log(`Guía extendida creada exitosamente: ID ${guia.id_guia}`);

      // Emitir evento WebSocket para actualizar los clientes en tiempo real
      this.websocketGateway.emitGuiaRemisionUpdate();

      // Obtener el siguiente número de guía disponible y emitirlo a todos los clientes
      const siguienteNumero = await this.getLastNumber();
      this.websocketGateway.emitSiguienteNumeroGuiaRemision({
        numero: siguienteNumero.numero + 1,
      });

      return {
        success: true,
        message: 'Guía de remisión extendida creada exitosamente',
        data: guia,
      };
    } catch (error) {
      this.logger.error('Error creando guía extendida:', error);
      throw new HttpException(
        error.message || 'Error creando guía de remisión extendida',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Actualizar guía existente
   */
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    try {
      // Verificar que la guía existe
      const existingGuia =
        await this.prismaService.guia_remision_extendida.findUnique({
          where: { id_guia: parseInt(id) },
        });

      if (!existingGuia) {
        throw new HttpException(
          'Guía extendida no encontrada',
          HttpStatus.NOT_FOUND,
        );
      }

      // No permitir edición de guías ya procesadas
      if (existingGuia.estado_gre && existingGuia.estado_gre !== 'FALLADO') {
        throw new HttpException(
          'No se puede editar una guía que ya está en proceso o completada',
          HttpStatus.BAD_REQUEST,
        );
      }

      const { items, documento_relacionado, ...updateData } = data;

      // Convertir fechas a Date objects en timezone de Perú
      if (updateData.fecha_de_emision) {
        console.log(
          '📅 [CRUD EXTENDIDO UPDATE] Fecha emision recibida:',
          updateData.fecha_de_emision,
        );
        updateData.fecha_de_emision = dayjs
          .tz(updateData.fecha_de_emision, 'America/Lima')
          .toDate();
        console.log(
          '📅 [CRUD EXTENDIDO UPDATE] Fecha emision convertida:',
          updateData.fecha_de_emision.toISOString(),
        );
      }
      if (updateData.fecha_de_inicio_de_traslado) {
        console.log(
          '📅 [CRUD EXTENDIDO UPDATE] Fecha inicio traslado recibida:',
          updateData.fecha_de_inicio_de_traslado,
        );
        updateData.fecha_de_inicio_de_traslado = dayjs
          .tz(updateData.fecha_de_inicio_de_traslado, 'America/Lima')
          .toDate();
        console.log(
          '📅 [CRUD EXTENDIDO UPDATE] Fecha inicio convertida:',
          updateData.fecha_de_inicio_de_traslado.toISOString(),
        );
      }

      const updatedGuia =
        await this.prismaService.guia_remision_extendida.update({
          where: { id_guia: parseInt(id) },
          data: updateData,
        });

      return {
        success: true,
        message: 'Guía extendida actualizada exitosamente',
        data: updatedGuia,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error actualizando guía extendida ${id}:`, error);
      throw new HttpException(
        'Error actualizando guía de remisión extendida',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Eliminar guía (solo si no está procesada)
   */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      const guia = await this.prismaService.guia_remision_extendida.findUnique({
        where: { id_guia: parseInt(id) },
      });

      if (!guia) {
        throw new HttpException(
          'Guía extendida no encontrada',
          HttpStatus.NOT_FOUND,
        );
      }

      // Solo permitir eliminar guías en estado NULL o FALLADO
      if (guia.estado_gre && guia.estado_gre !== 'FALLADO') {
        throw new HttpException(
          'No se puede eliminar una guía que ya está en proceso o completada',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.prismaService.guia_remision_extendida.delete({
        where: { id_guia: parseInt(id) },
      });

      return {
        success: true,
        message: 'Guía extendida eliminada exitosamente',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error eliminando guía extendida ${id}:`, error);
      throw new HttpException(
        'Error eliminando guía de remisión extendida',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Recuperar archivos de una guía extendida específica desde SUNAT
   */
  @Post('manual-consulta/:id_guia')
  async manualConsultaGuiaExtendida(@Param('id_guia') id_guia: string) {
    try {
      const guiaId = parseInt(id_guia);

      // 1. Buscar la guía extendida en BD
      const guia = await this.prismaService.guia_remision_extendida.findUnique({
        where: { id_guia: guiaId },
      });

      if (!guia) {
        throw new HttpException(
          'Guía extendida no encontrada',
          HttpStatus.NOT_FOUND,
        );
      }

      // 2. Validar estado de la guía
      if (
        !guia.estado_gre ||
        guia.estado_gre === 'PENDIENTE' ||
        guia.estado_gre === 'FALLADO'
      ) {
        this.logger.log(
          `⚠️ Guía extendida ${guia.serie}-${guia.numero} tiene estado: ${guia.estado_gre || 'NULL'}`,
        );
        throw new HttpException(
          `La guía ${guia.serie}-${guia.numero} no ha sido generada exitosamente en Nubefact. ` +
            `Estado actual: ${guia.estado_gre || 'NO PROCESADO'}. ` +
            `Por favor, espere a que se procese antes de intentar recuperar archivos.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 3. Preparar datos para consultar_guia
      const consultaData = {
        operacion: 'consultar_guia',
        tipo_de_comprobante: guia.tipo_de_comprobante,
        serie: guia.serie,
        numero: guia.numero,
      };

      this.logger.log(
        `📋 Consultando guía extendida manualmente: ${guia.serie}-${guia.numero}`,
      );

      // 4. Llamar a NUBEFACT consultar_guia
      const NUBEFACT_CONSULTAR_URL = process.env.NUBEFACT_CONSULTAR_URL;
      const NUBEFACT_TOKEN = process.env.NUBEFACT_TOKEN;

      const axios = require('axios');
      const response = await axios.post(NUBEFACT_CONSULTAR_URL, consultaData, {
        headers: {
          Authorization: `Token ${NUBEFACT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      // 5. Verificar si tenemos enlaces
      const {
        enlace_del_pdf,
        enlace_del_xml,
        enlace_del_cdr,
        aceptada_por_sunat,
        sunat_description,
      } = response.data;

      if (!enlace_del_pdf || !enlace_del_xml || !enlace_del_cdr) {
        this.logger.log(
          `⚠️ SUNAT aún no ha generado los archivos para ${guia.serie}-${guia.numero}`,
        );
        return {
          success: false,
          message:
            'SUNAT aún no ha generado los archivos. Intente nuevamente en unos minutos.',
          data: response.data,
        };
      }

      // 6. Actualizar BD con los enlaces
      const guiaActualizada =
        await this.prismaService.guia_remision_extendida.update({
          where: { id_guia: guia.id_guia },
          data: {
            estado_gre: 'COMPLETADO',
            enlace_del_pdf,
            enlace_del_xml,
            enlace_del_cdr,
            aceptada_por_sunat,
            sunat_description,
          },
        });

      this.logger.log(
        `✅ Enlaces recuperados exitosamente para guía extendida ${guia.serie}-${guia.numero}`,
      );

      // 7. Emitir evento WebSocket para actualizar los clientes en tiempo real
      this.websocketGateway.emitGuiaRemisionUpdate();

      return {
        success: true,
        message: 'Enlaces recuperados exitosamente',
        data: {
          id_guia: guiaActualizada.id_guia,
          serie: guiaActualizada.serie,
          numero: guiaActualizada.numero,
          estado_gre: guiaActualizada.estado_gre,
          enlace_del_pdf,
          enlace_del_xml,
          enlace_del_cdr,
        },
      };
    } catch (error) {
      this.logger.error('Error en consulta manual de guía extendida:', error);

      // Si es un error de Axios, extraer el mensaje
      if (error.response) {
        const errorMsg =
          error.response.data?.errors ||
          error.response.data?.message ||
          'Error al consultar SUNAT';
        throw new HttpException(errorMsg, HttpStatus.BAD_REQUEST);
      }

      // Si ya es HttpException, relanzar
      if (error instanceof HttpException) {
        throw error;
      }

      // Otros errores
      throw new HttpException(
        error.message || 'Error al recuperar archivos de la guía extendida',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Descargar todos los archivos de un identificador como ZIP
   * Actúa como proxy para evitar problemas de CORS
   */
  @Post('descargar-zip/:identificador')
  async descargarZip(
    @Param('identificador') identificador: string,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(
        `📦 Iniciando descarga de archivos para identificador: ${identificador}`,
      );

      // 1. Obtener todas las guías del identificador
      const guias = await this.prismaService.guia_remision_extendida.findMany({
        where: {
          identificador_unico: identificador,
        },
        select: {
          id_guia: true,
          serie: true,
          numero: true,
          enlace_del_pdf: true,
          enlace_del_xml: true,
          enlace_del_cdr: true,
        },
      });

      if (!guias || guias.length === 0) {
        throw new HttpException(
          'No se encontraron guías para este identificador',
          HttpStatus.NOT_FOUND,
        );
      }

      // 2. Filtrar solo las guías con todos los archivos
      const guiasCompletas = guias.filter(
        (g) => g.enlace_del_pdf && g.enlace_del_xml && g.enlace_del_cdr,
      );

      if (guiasCompletas.length === 0) {
        throw new HttpException(
          'No hay guías con archivos completos para descargar',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `📦 Encontradas ${guiasCompletas.length} guías completas para descargar`,
      );

      // 3. Configurar respuesta como archivo ZIP
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="guias_${identificador}.zip"`,
      );

      // 4. Crear archivo ZIP
      const archive = archiver('zip', {
        zlib: { level: 9 }, // Nivel máximo de compresión
      });

      // 5. Manejar errores del archiver
      archive.on('error', (err) => {
        this.logger.error('Error creando ZIP:', err);
        throw err;
      });

      // 6. Pipe el archivo ZIP a la respuesta
      archive.pipe(res);

      // 7. Descargar y agregar cada archivo al ZIP
      for (const guia of guiasCompletas) {
        const nombreGuia = `${guia.serie}-${String(guia.numero).padStart(4, '0')}`;

        try {
          // Descargar PDF
          if (guia.enlace_del_pdf) {
            this.logger.log(`📄 Descargando PDF: ${nombreGuia}.pdf`);
            const pdfResponse = await axios.get(guia.enlace_del_pdf, {
              responseType: 'arraybuffer',
            });
            archive.append(Buffer.from(pdfResponse.data), {
              name: `${nombreGuia}.pdf`,
            });
          }

          // Descargar XML
          if (guia.enlace_del_xml) {
            this.logger.log(`📄 Descargando XML: ${nombreGuia}.xml`);
            const xmlResponse = await axios.get(guia.enlace_del_xml, {
              responseType: 'arraybuffer',
            });
            archive.append(Buffer.from(xmlResponse.data), {
              name: `${nombreGuia}.xml`,
            });
          }

          // Descargar CDR
          if (guia.enlace_del_cdr) {
            this.logger.log(`📄 Descargando CDR: ${nombreGuia}_CDR.zip`);
            const cdrResponse = await axios.get(guia.enlace_del_cdr, {
              responseType: 'arraybuffer',
            });
            archive.append(Buffer.from(cdrResponse.data), {
              name: `${nombreGuia}_CDR.zip`,
            });
          }
        } catch (error) {
          this.logger.error(
            `Error descargando archivos de guía ${nombreGuia}:`,
            error,
          );
          // Continuar con las siguientes guías
        }
      }

      // 8. Finalizar el archivo ZIP
      await archive.finalize();
      this.logger.log(
        `✅ ZIP generado exitosamente con ${guiasCompletas.length * 3} archivos`,
      );
    } catch (error) {
      this.logger.error('Error generando ZIP:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error al generar el archivo ZIP',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Exportar programación extendida a Excel (una fila por guía)
   */
  @Post('exportar-excel')
  async exportarExcel(
    @Body() body: { proveedores?: string[] },
    @Res() res: Response,
  ) {
    try {
      const { proveedores } = body;

      const filterClause =
        proveedores && proveedores.length > 0
          ? Prisma.sql`AND e.razon_social IN (${Prisma.join(proveedores)})`
          : Prisma.empty;

      const rows = await this.prismaService.$queryRaw<any[]>(Prisma.sql`
        SELECT
          pt.id,
          pt.fecha,
          pt.hora_partida,
          pt.programacion,
          pt.estado_programacion,
          pt.comentarios,
          pt.m3,
          pt.cantidad_viaje,
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
          gre.serie,
          gre.numero AS numero_guia,
          gre.estado_gre,
          gre.enlace_del_pdf,
          gre.enlace_del_xml,
          gre.enlace_del_cdr
        FROM programacion_tecnica pt
        LEFT JOIN camiones c ON pt.unidad = c.id_camion
        LEFT JOIN empresas_2025 e ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
        LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
        LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
        LEFT JOIN guia_remision_extendida gre
          ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gre.identificador_unico COLLATE utf8mb4_unicode_ci
        WHERE pt.deleted_at IS NULL
        ${filterClause}
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

      // ── Colores ─────────────────────────────────────────────────────────
      const COLOR_HEADER_BG = 'FFD97706'; // naranja oscuro (brand)
      const COLOR_HEADER_FG = 'FFFFFFFF'; // blanco
      const COLOR_ROW_ALT = 'FFFFF7ED'; // naranja muy claro (filas pares)
      const COLOR_ROW_BASE = 'FFFFFFFF'; // blanco (filas impares)
      const COLOR_GUIA_BG = 'FFD1FAE5'; // verde claro (fila con guía completada)
      const COLOR_PDF_FG = 'FFB91C1C'; // rojo oscuro
      const COLOR_XML_FG = 'FF15803D'; // verde oscuro
      const COLOR_CDR_FG = 'FF1D4ED8'; // azul oscuro
      const COLOR_BORDER = 'FFD1D5DB'; // gris claro

      const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: COLOR_BORDER } },
        left: { style: 'thin', color: { argb: COLOR_BORDER } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
        right: { style: 'thin', color: { argb: COLOR_BORDER } },
      };

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Ayala Sistema';
      const ws = wb.addWorksheet('Prog. Extendida', {
        views: [{ state: 'frozen', ySplit: 1 }], // congelar encabezado
      });

      // ── Columnas ────────────────────────────────────────────────────────
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
        { header: 'Estado Prog.', key: 'estado_prog', width: 14 },
        { header: 'M3', key: 'm3', width: 8 },
        { header: 'Cant. Viajes', key: 'cant_viajes', width: 13 },
        { header: 'Identificador', key: 'identificador', width: 22 },
        { header: 'P. Partida Ubig.', key: 'partida_ubigeo', width: 17 },
        { header: 'P. Partida Dir.', key: 'partida_dir', width: 30 },
        { header: 'P. Llegada Ubig.', key: 'llegada_ubigeo', width: 17 },
        { header: 'P. Llegada Dir.', key: 'llegada_dir', width: 30 },
        { header: 'N° Guía', key: 'nro_guia', width: 16 },
        { header: 'Estado Guía', key: 'estado_guia', width: 14 },
        { header: 'PDF', key: 'pdf', width: 8 },
        { header: 'XML', key: 'xml', width: 8 },
        { header: 'CDR', key: 'cdr', width: 8 },
      ];

      // ── Estilo del encabezado ────────────────────────────────────────────
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

      // ── Filas de datos ───────────────────────────────────────────────────
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
        const numeroGuia =
          row.serie && row.numero_guia != null
            ? `${row.serie}-${String(row.numero_guia).padStart(4, '0')}`
            : '';
        const completada =
          row.enlace_del_pdf && row.enlace_del_xml && row.enlace_del_cdr;

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
          estado_prog: row.estado_programacion || '',
          m3: row.m3 != null ? row.m3.toString() : '',
          cant_viajes:
            row.cantidad_viaje != null ? Number(row.cantidad_viaje) : '',
          identificador: row.identificador_unico || '',
          partida_ubigeo: row.punto_partida_ubigeo || '',
          partida_dir: row.punto_partida_direccion || '',
          llegada_ubigeo: row.punto_llegada_ubigeo || '',
          llegada_dir: row.punto_llegada_direccion || '',
          nro_guia: numeroGuia,
          estado_guia: row.estado_gre || '',
          pdf: '',
          xml: '',
          cdr: '',
        });

        excelRow.height = 18;

        // Estilo base de cada celda
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

        // Estado Prog: color según valor
        const estadoCell = excelRow.getCell('estado_prog');
        if (row.estado_programacion === 'OK') {
          estadoCell.font = {
            size: 9,
            bold: true,
            color: { argb: 'FF15803D' },
          };
        } else if (row.estado_programacion === 'NO EJECUTADO') {
          estadoCell.font = {
            size: 9,
            bold: true,
            color: { argb: 'FFB91C1C' },
          };
        }

        // N° Guía: negrita si tiene
        if (numeroGuia) {
          excelRow.getCell('nro_guia').font = {
            size: 9,
            bold: true,
            color: { argb: 'FF374151' },
          };
        }

        // Hipervínculos con estilo
        const linkDefs = [
          {
            key: 'pdf',
            url: row.enlace_del_pdf,
            label: 'PDF',
            color: COLOR_PDF_FG,
          },
          {
            key: 'xml',
            url: row.enlace_del_xml,
            label: 'XML',
            color: COLOR_XML_FG,
          },
          {
            key: 'cdr',
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

      const buffer = (await wb.xlsx.writeBuffer()) as Buffer;
      const nombreArchivo = `programacion_extendida_${dayjs().format('YYYY-MM-DD')}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nombreArchivo}"`,
      );
      res.send(buffer);
    } catch (error) {
      this.logger.error('Error exportando a Excel:', error);
      throw new HttpException(
        'Error al generar el archivo Excel',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Validar datos de la guía
   */
  private validateGreData(data: any) {
    const required = [
      'operacion',
      'tipo_de_comprobante',
      'serie',
      'numero',
      'cliente_tipo_de_documento',
      'cliente_numero_de_documento',
      'cliente_denominacion',
      'cliente_direccion',
      // 'cliente_email' NO ES OBLIGATORIO - campo opcional
      'fecha_de_emision',
      'fecha_de_inicio_de_traslado',
      'peso_bruto_total',
      'peso_bruto_unidad_de_medida',
      'transportista_placa_numero',
      'punto_de_partida_ubigeo',
      'punto_de_partida_direccion',
      'punto_de_llegada_ubigeo',
      'punto_de_llegada_direccion',
    ];

    for (const field of required) {
      if (!data[field] && data[field] !== 0) {
        throw new Error(`Campo obligatorio faltante: ${field}`);
      }
    }

    // Validaciones específicas según tipo
    if (data.tipo_de_comprobante === 7) {
      // GRE Remitente
      if (!data.motivo_de_traslado)
        throw new Error('motivo_de_traslado es obligatorio para GRE Remitente');
      if (!data.numero_de_bultos)
        throw new Error('numero_de_bultos es obligatorio para GRE Remitente');
      if (!data.tipo_de_transporte)
        throw new Error('tipo_de_transporte es obligatorio para GRE Remitente');
    } else if (data.tipo_de_comprobante === 8) {
      // GRE Transportista
      if (!data.conductor_documento_tipo)
        throw new Error(
          'conductor_documento_tipo es obligatorio para GRE Transportista',
        );
      if (!data.destinatario_documento_tipo)
        throw new Error(
          'destinatario_documento_tipo es obligatorio para GRE Transportista',
        );
    }

    // Validar items
    if (!data.items || data.items.length === 0) {
      throw new Error('Debe incluir al menos un item');
    }
  }
}
