import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

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
        .filter((id) => id !== null) as string[];

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
      const lastGuia = await this.prismaService.guia_remision_extendida.findFirst({
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
      this.logger.error(`Error obteniendo guías por identificador ${identificador}:`, error);
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
        throw new HttpException('Guía extendida no encontrada', HttpStatus.NOT_FOUND);
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
      const { items, documento_relacionado, vehiculos_secundarios, conductores_secundarios, ...greData } = data;

      // Convertir fechas a Date objects en timezone de Perú para evitar desfase de días
      // dayjs.tz() crea la fecha específicamente en timezone de Perú (America/Lima)
      console.log('📅 [CRUD EXTENDIDO] Fecha recibida del frontend:', greData.fecha_de_emision, greData.fecha_de_inicio_de_traslado);

      const fechaEmisionPeru = dayjs.tz(greData.fecha_de_emision, 'America/Lima').toDate();
      const fechaInicioPeru = dayjs.tz(greData.fecha_de_inicio_de_traslado, 'America/Lima').toDate();

      console.log('📅 [CRUD EXTENDIDO] Fecha emision en Perú:', fechaEmisionPeru.toISOString());
      console.log('📅 [CRUD EXTENDIDO] Fecha inicio en Perú:', fechaInicioPeru.toISOString());

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
          items_extendida: items && items.length > 0 ? {
            create: items.map((item: any, index: number) => ({
              unidad_de_medida: item.unidad_de_medida,
              codigo: item.codigo,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              orden: index + 1,
            })),
          } : undefined,
          documento_relacionado_extendida: documento_relacionado && documento_relacionado.length > 0 ? {
            create: documento_relacionado.map((doc: any) => ({
              tipo: doc.tipo,
              serie: doc.serie,
              numero: parseInt(doc.numero),
            })),
          } : undefined,
          vehiculos_secundarios_extendida: vehiculos_secundarios && vehiculos_secundarios.length > 0 ? {
            create: vehiculos_secundarios.map((vehiculo: any) => ({
              placa_numero: vehiculo.placa_numero,
              tuc: vehiculo.tuc,
            })),
          } : undefined,
          conductores_secundarios_extendida: conductores_secundarios && conductores_secundarios.length > 0 ? {
            create: conductores_secundarios.map((conductor: any) => ({
              documento_tipo: parseInt(conductor.documento_tipo),
              documento_numero: conductor.documento_numero,
              nombre: conductor.nombre,
              apellidos: conductor.apellidos,
              numero_licencia: conductor.numero_licencia,
            })),
          } : undefined,
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
      this.websocketGateway.emitSiguienteNumeroGuiaRemision({ numero: siguienteNumero.numero + 1 });

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
      const existingGuia = await this.prismaService.guia_remision_extendida.findUnique({
        where: { id_guia: parseInt(id) },
      });

      if (!existingGuia) {
        throw new HttpException('Guía extendida no encontrada', HttpStatus.NOT_FOUND);
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
        console.log('📅 [CRUD EXTENDIDO UPDATE] Fecha emision recibida:', updateData.fecha_de_emision);
        updateData.fecha_de_emision = dayjs.tz(updateData.fecha_de_emision, 'America/Lima').toDate();
        console.log('📅 [CRUD EXTENDIDO UPDATE] Fecha emision convertida:', updateData.fecha_de_emision.toISOString());
      }
      if (updateData.fecha_de_inicio_de_traslado) {
        console.log('📅 [CRUD EXTENDIDO UPDATE] Fecha inicio traslado recibida:', updateData.fecha_de_inicio_de_traslado);
        updateData.fecha_de_inicio_de_traslado = dayjs.tz(updateData.fecha_de_inicio_de_traslado, 'America/Lima').toDate();
        console.log('📅 [CRUD EXTENDIDO UPDATE] Fecha inicio convertida:', updateData.fecha_de_inicio_de_traslado.toISOString());
      }

      const updatedGuia = await this.prismaService.guia_remision_extendida.update({
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
        throw new HttpException('Guía extendida no encontrada', HttpStatus.NOT_FOUND);
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
        where: { id_guia: guiaId }
      });

      if (!guia) {
        throw new HttpException('Guía extendida no encontrada', HttpStatus.NOT_FOUND);
      }

      // 2. Validar estado de la guía
      if (!guia.estado_gre || guia.estado_gre === 'PENDIENTE' || guia.estado_gre === 'FALLADO') {
        this.logger.log(`⚠️ Guía extendida ${guia.serie}-${guia.numero} tiene estado: ${guia.estado_gre || 'NULL'}`);
        throw new HttpException(
          `La guía ${guia.serie}-${guia.numero} no ha sido generada exitosamente en Nubefact. ` +
          `Estado actual: ${guia.estado_gre || 'NO PROCESADO'}. ` +
          `Por favor, espere a que se procese antes de intentar recuperar archivos.`,
          HttpStatus.BAD_REQUEST
        );
      }

      // 3. Preparar datos para consultar_guia
      const consultaData = {
        operacion: 'consultar_guia',
        tipo_de_comprobante: guia.tipo_de_comprobante,
        serie: guia.serie,
        numero: guia.numero
      };

      this.logger.log(`📋 Consultando guía extendida manualmente: ${guia.serie}-${guia.numero}`);

      // 4. Llamar a NUBEFACT consultar_guia
      const NUBEFACT_CONSULTAR_URL = process.env.NUBEFACT_CONSULTAR_URL;
      const NUBEFACT_TOKEN = process.env.NUBEFACT_TOKEN;

      const axios = require('axios');
      const response = await axios.post(NUBEFACT_CONSULTAR_URL, consultaData, {
        headers: {
          'Authorization': `Token ${NUBEFACT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      // 5. Verificar si tenemos enlaces
      const { enlace_del_pdf, enlace_del_xml, enlace_del_cdr,
              aceptada_por_sunat, sunat_description } = response.data;

      if (!enlace_del_pdf || !enlace_del_xml || !enlace_del_cdr) {
        this.logger.log(`⚠️ SUNAT aún no ha generado los archivos para ${guia.serie}-${guia.numero}`);
        return {
          success: false,
          message: 'SUNAT aún no ha generado los archivos. Intente nuevamente en unos minutos.',
          data: response.data
        };
      }

      // 6. Actualizar BD con los enlaces
      const guiaActualizada = await this.prismaService.guia_remision_extendida.update({
        where: { id_guia: guia.id_guia },
        data: {
          estado_gre: 'COMPLETADO',
          enlace_del_pdf,
          enlace_del_xml,
          enlace_del_cdr,
          aceptada_por_sunat,
          sunat_description
        }
      });

      this.logger.log(`✅ Enlaces recuperados exitosamente para guía extendida ${guia.serie}-${guia.numero}`);

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
          enlace_del_cdr
        }
      };

    } catch (error) {
      this.logger.error('Error en consulta manual de guía extendida:', error);

      // Si es un error de Axios, extraer el mensaje
      if (error.response) {
        const errorMsg = error.response.data?.errors || error.response.data?.message || 'Error al consultar SUNAT';
        throw new HttpException(errorMsg, HttpStatus.BAD_REQUEST);
      }

      // Si ya es HttpException, relanzar
      if (error instanceof HttpException) {
        throw error;
      }

      // Otros errores
      throw new HttpException(
        error.message || 'Error al recuperar archivos de la guía extendida',
        HttpStatus.INTERNAL_SERVER_ERROR
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
      if (!data.motivo_de_traslado) throw new Error('motivo_de_traslado es obligatorio para GRE Remitente');
      if (!data.numero_de_bultos) throw new Error('numero_de_bultos es obligatorio para GRE Remitente');
      if (!data.tipo_de_transporte) throw new Error('tipo_de_transporte es obligatorio para GRE Remitente');
    } else if (data.tipo_de_comprobante === 8) {
      // GRE Transportista
      if (!data.conductor_documento_tipo) throw new Error('conductor_documento_tipo es obligatorio para GRE Transportista');
      if (!data.destinatario_documento_tipo) throw new Error('destinatario_documento_tipo es obligatorio para GRE Transportista');
    }

    // Validar items
    if (!data.items || data.items.length === 0) {
      throw new Error('Debe incluir al menos un item');
    }
  }
}
