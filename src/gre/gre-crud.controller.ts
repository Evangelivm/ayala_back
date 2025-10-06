import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('guias-remision')
export class GreCrudController {
  private readonly logger = new Logger(GreCrudController.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Obtener el último número de guía registrado
   */
  @Get('ultimo-numero')
  async getLastNumber() {
    try {
      const lastGuia = await this.prismaService.guia_remision.findFirst({
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
        'Error obteniendo último número de guía',
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
        this.prismaService.guia_remision.findMany({
          where,
          skip,
          take: limitNum,
          include: {
            items: true,
            documento_relacionado: true,
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
        this.prismaService.guia_remision.count({ where }),
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
      this.logger.error('Error obteniendo guías:', error);
      throw new HttpException(
        'Error obteniendo guías de remisión',
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
      const guia = await this.prismaService.guia_remision.findUnique({
        where: { id_guia: parseInt(id) },
        include: {
          items: true,
          documento_relacionado: true,
          vehiculos_secundarios: true,
          conductores_secundarios: true,
          proyecto: true,
          etapas: true,
          sector: true,
          frente: true,
          partida: true,
        },
      });

      if (!guia) {
        throw new HttpException('Guía no encontrada', HttpStatus.NOT_FOUND);
      }

      return guia;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error obteniendo guía ${id}:`, error);
      throw new HttpException(
        'Error obteniendo guía de remisión',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Crear nueva guía de remisión
   */
  @Post()
  async create(@Body() data: any) {
    try {
      this.logger.log('Creando nueva guía de remisión');

      // Validar campos obligatorios
      this.validateGreData(data);

      // Extraer items y documentos relacionados
      const { items, documento_relacionado, vehiculos_secundarios, conductores_secundarios, ...greData } = data;

      // Formatear fechas
      const formattedData = {
        ...greData,
        fecha_de_emision: new Date(greData.fecha_de_emision),
        fecha_de_inicio_de_traslado: new Date(greData.fecha_de_inicio_de_traslado),
        estado_gre: null, // Estado inicial NULL para que el detector lo procese
      };

      // Crear guía con relaciones
      const guia = await this.prismaService.guia_remision.create({
        data: {
          ...formattedData,
          items: items && items.length > 0 ? {
            create: items.map((item: any, index: number) => ({
              unidad_de_medida: item.unidad_de_medida,
              codigo: item.codigo,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              orden: index + 1,
            })),
          } : undefined,
          documento_relacionado: documento_relacionado && documento_relacionado.length > 0 ? {
            create: documento_relacionado.map((doc: any) => ({
              tipo: doc.tipo,
              serie: doc.serie,
              numero: parseInt(doc.numero),
            })),
          } : undefined,
          vehiculos_secundarios: vehiculos_secundarios && vehiculos_secundarios.length > 0 ? {
            create: vehiculos_secundarios.map((vehiculo: any) => ({
              placa_numero: vehiculo.placa_numero,
              tuc: vehiculo.tuc,
            })),
          } : undefined,
          conductores_secundarios: conductores_secundarios && conductores_secundarios.length > 0 ? {
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
          items: true,
          documento_relacionado: true,
          vehiculos_secundarios: true,
          conductores_secundarios: true,
        },
      });

      this.logger.log(`Guía creada exitosamente: ID ${guia.id_guia}`);

      return {
        success: true,
        message: 'Guía de remisión creada exitosamente',
        data: guia,
      };
    } catch (error) {
      this.logger.error('Error creando guía:', error);
      throw new HttpException(
        error.message || 'Error creando guía de remisión',
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
      const existingGuia = await this.prismaService.guia_remision.findUnique({
        where: { id_guia: parseInt(id) },
      });

      if (!existingGuia) {
        throw new HttpException('Guía no encontrada', HttpStatus.NOT_FOUND);
      }

      // No permitir edición de guías ya procesadas
      if (existingGuia.estado_gre && existingGuia.estado_gre !== 'FALLADO') {
        throw new HttpException(
          'No se puede editar una guía que ya está en proceso o completada',
          HttpStatus.BAD_REQUEST,
        );
      }

      const { items, documento_relacionado, ...updateData } = data;

      // Formatear fechas si vienen en la actualización
      if (updateData.fecha_de_emision) {
        updateData.fecha_de_emision = new Date(updateData.fecha_de_emision);
      }
      if (updateData.fecha_de_inicio_de_traslado) {
        updateData.fecha_de_inicio_de_traslado = new Date(updateData.fecha_de_inicio_de_traslado);
      }

      const updatedGuia = await this.prismaService.guia_remision.update({
        where: { id_guia: parseInt(id) },
        data: updateData,
        include: {
          items: true,
          documento_relacionado: true,
        },
      });

      return {
        success: true,
        message: 'Guía actualizada exitosamente',
        data: updatedGuia,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error actualizando guía ${id}:`, error);
      throw new HttpException(
        'Error actualizando guía de remisión',
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
      const guia = await this.prismaService.guia_remision.findUnique({
        where: { id_guia: parseInt(id) },
      });

      if (!guia) {
        throw new HttpException('Guía no encontrada', HttpStatus.NOT_FOUND);
      }

      // Solo permitir eliminar guías en estado NULL o FALLADO
      if (guia.estado_gre && guia.estado_gre !== 'FALLADO') {
        throw new HttpException(
          'No se puede eliminar una guía que ya está en proceso o completada',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.prismaService.guia_remision.delete({
        where: { id_guia: parseInt(id) },
      });

      return {
        success: true,
        message: 'Guía eliminada exitosamente',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error eliminando guía ${id}:`, error);
      throw new HttpException(
        'Error eliminando guía de remisión',
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
