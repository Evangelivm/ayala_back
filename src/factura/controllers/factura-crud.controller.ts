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
  UsePipes,
} from '@nestjs/common';
import { PrismaThirdService } from '../../prisma/prisma-third.service';
import { ZodValidationPipe } from '../../pipes/zod-validation.pipe';
import { CreateFacturaSchema } from '../dto/create-factura.dto';
import { UpdateFacturaSchema } from '../dto/update-factura.dto';
import { FacturaConsumerService } from '../services/factura-consumer.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';

@Controller('facturas')
export class FacturaCrudController {
  private readonly logger = new Logger(FacturaCrudController.name);

  constructor(
    private readonly prisma: PrismaThirdService,
    private readonly facturaConsumer: FacturaConsumerService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  /**
   * Mapea unidades de medida comunes a códigos SUNAT válidos
   */
  /**
   * Convierte una fecha en formato DD-MM-YYYY o YYYY-MM-DD a objeto Date
   * @param dateString - Fecha en formato DD-MM-YYYY o YYYY-MM-DD
   * @returns Date object o null si es inválido
   */
  private parseDate(dateString: string | null | undefined): Date | null {
    if (!dateString || dateString.trim() === '') {
      return null;
    }

    const parts = dateString.split('-');
    if (parts.length !== 3) {
      return null;
    }

    let year: number, month: number, day: number;

    // Detectar formato: si el primer elemento tiene 4 dígitos es YYYY-MM-DD
    if (parts[0].length === 4) {
      // Formato YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      // Formato DD-MM-YYYY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }

    const date = new Date(year, month, day);

    // Verificar que la fecha sea válida
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  private mapearUnidadMedidaSunat(unidad: string): string {
    const mapeo: Record<string, string> = {
      'UNIDAD': 'NIU',
      'UNIDADES': 'NIU',
      'UND': 'NIU',
      'SERVICIO': 'ZZ',
      'SERVICIOS': 'ZZ',
      'SRV': 'ZZ',
      'METRO': 'MTR',
      'METROS': 'MTR',
      'M': 'MTR',
      'KILOGRAMO': 'KGM',
      'KILOGRAMOS': 'KGM',
      'KG': 'KGM',
      'LITRO': 'LTR',
      'LITROS': 'LTR',
      'L': 'LTR',
      'METRO CUBICO': 'MTQ',
      'M3': 'MTQ',
      'TONELADA': 'TNE',
      'TONELADAS': 'TNE',
      'TON': 'TNE',
      'CAJA': 'BX',
      'CAJAS': 'BX',
      'BOLSA': 'BG',
      'BOLSAS': 'BG',
      'PAQUETE': 'PK',
      'PAQUETES': 'PK',
    };

    const unidadUpper = unidad.toUpperCase().trim();
    const unidadMapeada = mapeo[unidadUpper] || unidad;

    if (unidadMapeada !== unidad) {
      this.logger.debug(`Unidad de medida mapeada: "${unidad}" -> "${unidadMapeada}"`);
    }

    return unidadMapeada;
  }

  /**
   * GET /facturas/ultimo-numero
   * Obtiene el último número de factura registrado para una serie
   */
  @Get('ultimo-numero')
  async getLastNumber(@Query('serie') serie: string = 'F001') {
    try {
      const lastFactura = await this.prisma.factura.findFirst({
        where: { serie },
        orderBy: { numero: 'desc' },
        select: { numero: true },
      });

      return {
        serie,
        numero: lastFactura ? lastFactura.numero : 0,
      };
    } catch (error) {
      this.logger.error('Error obteniendo último número:', error);
      throw new HttpException(
        'Error obteniendo último número de factura',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /facturas
   * Obtiene todas las facturas con paginación y filtros
   */
  @Get()
  async getAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('fecha_desde') fechaDesde?: string,
    @Query('fecha_hasta') fechaHasta?: string,
    @Query('id_proveedor') idProveedor?: string,
    @Query('estado_factura') estadoFactura?: string,
    @Query('serie') serie?: string,
    @Query('tipo_comprobante') tipoComprobante?: string,
  ) {
    try {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Construir filtros
      const where: any = {};

      if (fechaDesde || fechaHasta) {
        where.fecha_emision = {};
        if (fechaDesde) where.fecha_emision.gte = new Date(fechaDesde);
        if (fechaHasta) where.fecha_emision.lte = new Date(fechaHasta);
      }

      if (idProveedor) where.id_proveedor = parseInt(idProveedor);
      if (estadoFactura) where.estado_factura = estadoFactura;
      if (serie) where.serie = serie;
      if (tipoComprobante)
        where.tipo_de_comprobante = parseInt(tipoComprobante);

      // Obtener datos con relaciones
      const [facturas, total] = await Promise.all([
        this.prisma.factura.findMany({
          where,
          skip,
          take: limitNum,
          include: {
            factura_item: true,
            factura_guia: true,
            factura_venta_credito: true,
            proveedores: {
              select: {
                id_proveedor: true,
                nombre_proveedor: true,
                ruc: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
        }),
        this.prisma.factura.count({ where }),
      ]);

      return {
        data: facturas,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      this.logger.error('Error obteniendo facturas:', error);
      throw new HttpException(
        'Error obteniendo facturas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /facturas/:id
   * Obtiene una factura por ID
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    try {
      const factura = await this.prisma.factura.findUnique({
        where: { id_factura: parseInt(id) },
        include: {
          factura_item: true,
          factura_guia: true,
          factura_venta_credito: true,
          proveedores: true,
        },
      });

      if (!factura) {
        throw new HttpException('Factura no encontrada', HttpStatus.NOT_FOUND);
      }

      return factura;
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(`Error obteniendo factura ${id}:`, error);
      throw new HttpException(
        'Error obteniendo factura',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /facturas
   * Crea una nueva factura con estado NULL
   */
  @Post()
  @UsePipes(new ZodValidationPipe(CreateFacturaSchema))
  async create(@Body() data: any) {
    try {
      this.logger.log(`Creando nueva factura ${data.serie}-${data.numero}...`);

      // 1. Validar que el proveedor existe
      const proveedor = await this.prisma.proveedores.findUnique({
        where: { id_proveedor: data.id_proveedor },
      });

      if (!proveedor) {
        throw new HttpException(
          `Proveedor con ID ${data.id_proveedor} no encontrado`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 2. Validar que serie/número sean únicos
      const facturaExistente = await this.prisma.factura.findUnique({
        where: {
          serie_numero: {
            serie: data.serie,
            numero: data.numero,
          },
        },
      });

      if (facturaExistente) {
        throw new HttpException(
          `Ya existe una factura con serie ${data.serie} y número ${data.numero}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // DEBUG: Log de datos recibidos para forma de pago
      this.logger.debug(`[FORMA DE PAGO] condiciones_de_pago: ${data.condiciones_de_pago}`);
      this.logger.debug(`[FORMA DE PAGO] medio_de_pago: ${data.medio_de_pago}`);
      this.logger.debug(`[FORMA DE PAGO] venta_al_credito: ${JSON.stringify(data.venta_al_credito)}`);
      this.logger.debug(`[FORMA DE PAGO] cuotas_credito: ${JSON.stringify(data.cuotas_credito)}`);

      // 3. Crear factura con items, guías y cuotas en una transacción
      const factura = await this.prisma.$transaction(async (tx) => {
        // Crear la factura principal con estado NULL
        const nuevaFactura = await tx.factura.create({
          data: {
            // Estado NULL para que el detector la procese
            estado_factura: null,

            // Datos principales
            operacion: 'generar_comprobante',
            tipo_de_comprobante: data.tipo_de_comprobante,
            serie: data.serie,
            numero: data.numero,
            sunat_transaction: data.sunat_transaction || 1,
            id_proveedor: data.id_proveedor,

            // Cliente
            cliente_tipo_documento: data.cliente_tipo_documento || 6,
            cliente_numero_documento: data.cliente_numero_documento,
            cliente_denominacion: data.cliente_denominacion,
            cliente_direccion: data.cliente_direccion,
            cliente_email: data.cliente_email,
            cliente_email_1: data.cliente_email_1,
            cliente_email_2: data.cliente_email_2,

            // Fechas (soporta DD-MM-YYYY y YYYY-MM-DD)
            fecha_emision: this.parseDate(data.fecha_emision) || new Date(),
            fecha_vencimiento: this.parseDate(data.fecha_vencimiento),
            fecha_servicio: this.parseDate(data.fecha_servicio),

            // Moneda y totales
            moneda: data.moneda || 1,
            tipo_cambio: data.tipo_cambio,
            porcentaje_igv: data.porcentaje_igv || 18.0,
            descuento_global: data.descuento_global,
            total_descuento: data.total_descuento,
            total_anticipo: data.total_anticipo,
            total_gravada: data.total_gravada,
            total_inafecta: data.total_inafecta,
            total_exonerada: data.total_exonerada,
            total_igv: data.total_igv,
            total_gratuita: data.total_gratuita,
            total_otros_cargos: data.total_otros_cargos,
            total_isc: data.total_isc,
            total: data.total,

            // Detracción
            aplicar_detraccion: data.aplicar_detraccion || false,
            detraccion_tipo: data.detraccion_tipo,
            detraccion_porcentaje: data.detraccion_porcentaje,
            detraccion_total: data.detraccion_total,
            medio_pago_detraccion: data.medio_pago_detraccion,

            // Ubicaciones (para servicios de transporte)
            ubigeo_origen: data.ubigeo_origen,
            direccion_origen: data.direccion_origen,
            ubigeo_destino: data.ubigeo_destino,
            direccion_destino: data.direccion_destino,
            detalle_viaje: data.detalle_viaje,

            // Percepción
            percepcion_tipo: data.percepcion_tipo,
            percepcion_base_imponible: data.percepcion_base_imponible,
            total_percepcion: data.total_percepcion,
            total_incluido_percepcion: data.total_incluido_percepcion,

            // Retención
            retencion_tipo: data.retencion_tipo,
            retencion_base_imponible: data.retencion_base_imponible,
            total_retencion: data.total_retencion,

            // Opcionales
            fondo_garantia: data.fondo_garantia || false,
            fondo_garantia_valor: data.fondo_garantia_valor,
            orden_compra: data.orden_compra || false,
            orden_compra_valor: data.orden_compra_valor,
            placa_vehiculo: data.placa_vehiculo,
            orden_compra_servicio: data.orden_compra_servicio,

            // Forma de pago (según documentación NubeFact)
            condiciones_de_pago: data.condiciones_de_pago,
            medio_de_pago: data.medio_de_pago,

            // Centros de costo
            centro_costo_nivel1_codigo: data.centro_costo_nivel1_codigo,
            centro_costo_nivel2_codigo: data.centro_costo_nivel2_codigo,
            centro_costo_nivel3_codigo: data.centro_costo_nivel3_codigo,
            unidad: data.unidad,
            unidad_id: data.unidad_id,

            // Observaciones
            observaciones: data.observaciones,

            // Configuración de envío
            enviar_automaticamente_sunat: data.enviar_automaticamente_sunat !== false,
            enviar_automaticamente_cliente: data.enviar_automaticamente_cliente || false,
            formato_pdf: data.formato_pdf || 'A4',
          },
        });

        // Crear items de la factura
        if (data.items && data.items.length > 0) {
          await Promise.all(
            data.items.map((item: any) =>
              tx.factura_item.create({
                data: {
                  id_factura: nuevaFactura.id_factura,
                  codigo_item: item.codigo_item,
                  codigo_producto_sunat: item.codigo_producto_sunat,
                  descripcion_item: item.descripcion_item,
                  unidad_medida: this.mapearUnidadMedidaSunat(item.unidad_medida),
                  cantidad: item.cantidad,
                  valor_unitario: item.valor_unitario,
                  precio_unitario: item.precio_unitario,
                  descuento: item.descuento,
                  subtotal: item.subtotal,
                  tipo_de_igv: item.tipo_de_igv,
                  igv: item.igv,
                  tipo_de_isc: item.tipo_de_isc,
                  isc: item.isc,
                  total: item.total,
                  anticipo_regularizacion: item.anticipo_regularizacion || false,
                  anticipo_documento_serie: item.anticipo_documento_serie,
                  anticipo_documento_numero: item.anticipo_documento_numero,
                },
              }),
            ),
          );
        }

        // Crear guías relacionadas si existen
        if (data.guias && data.guias.length > 0) {
          await Promise.all(
            data.guias.map((guia: any) =>
              tx.factura_guia.create({
                data: {
                  id_factura: nuevaFactura.id_factura,
                  guia_tipo: guia.guia_tipo,
                  guia_serie_numero: guia.guia_serie_numero,
                },
              }),
            ),
          );
        }

        // Crear cuotas de crédito si existen (soporta ambos nombres por compatibilidad)
        const cuotasCredito = data.venta_al_credito || data.cuotas_credito;
        if (cuotasCredito && cuotasCredito.length > 0) {
          await Promise.all(
            cuotasCredito.map((cuota: any) =>
              tx.factura_venta_credito.create({
                data: {
                  id_factura: nuevaFactura.id_factura,
                  cuota: cuota.cuota,
                  fecha_pago: this.parseDate(cuota.fecha_de_pago || cuota.fecha_pago) || new Date(),
                  importe: cuota.importe,
                },
              }),
            ),
          );
        }

        return nuevaFactura;
      });

      this.logger.log(
        `Factura ${factura.serie}-${factura.numero} creada exitosamente con ID ${factura.id_factura}`,
      );

      // Retornar la factura creada con sus relaciones
      const facturaCompleta = await this.prisma.factura.findUnique({
        where: { id_factura: factura.id_factura },
        include: {
          factura_item: true,
          factura_guia: true,
          factura_venta_credito: true,
          proveedores: {
            select: {
              id_proveedor: true,
              nombre_proveedor: true,
              ruc: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Factura creada exitosamente',
        data: facturaCompleta,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error('Error creando factura:', error);
      throw new HttpException(
        error.message || 'Error creando factura',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /facturas/:id
   * Actualiza una factura (solo si está en estado NULL o FALLADO)
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateFacturaSchema)) data: any
  ) {
    try {
      const id_factura = parseInt(id);
      this.logger.log(`Actualizando factura ${id}...`);

      // 1. Verificar que la factura existe y está en estado editable
      const factura = await this.prisma.factura.findUnique({
        where: { id_factura },
      });

      if (!factura) {
        throw new HttpException('Factura no encontrada', HttpStatus.NOT_FOUND);
      }

      if (
        factura.estado_factura !== null &&
        factura.estado_factura !== 'FALLADO'
      ) {
        throw new HttpException(
          `No se puede editar una factura en estado ${factura.estado_factura}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 2. Si se cambió serie/número, validar que no exista otra factura con esos datos
      if (
        data.serie &&
        data.numero &&
        (data.serie !== factura.serie || data.numero !== factura.numero)
      ) {
        const facturaExistente = await this.prisma.factura.findUnique({
          where: {
            serie_numero: {
              serie: data.serie,
              numero: data.numero,
            },
          },
        });

        if (facturaExistente && facturaExistente.id_factura !== id_factura) {
          throw new HttpException(
            `Ya existe otra factura con serie ${data.serie} y número ${data.numero}`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // 3. Si se cambió el proveedor, validar que existe
      if (data.id_proveedor && data.id_proveedor !== factura.id_proveedor) {
        const proveedor = await this.prisma.proveedores.findUnique({
          where: { id_proveedor: data.id_proveedor },
        });

        if (!proveedor) {
          throw new HttpException(
            `Proveedor con ID ${data.id_proveedor} no encontrado`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // 4. Actualizar factura, items, guías y cuotas en una transacción
      const facturaActualizada = await this.prisma.$transaction(async (tx) => {
        // Actualizar la factura principal (solo campos proporcionados)
        const facturaData: any = {
          updated_at: new Date(),
        };

        // Mapear solo los campos que vienen en data
        if (data.tipo_de_comprobante !== undefined)
          facturaData.tipo_de_comprobante = data.tipo_de_comprobante;
        if (data.serie !== undefined) facturaData.serie = data.serie;
        if (data.numero !== undefined) facturaData.numero = data.numero;
        if (data.sunat_transaction !== undefined)
          facturaData.sunat_transaction = data.sunat_transaction;
        if (data.id_proveedor !== undefined)
          facturaData.id_proveedor = data.id_proveedor;

        // Cliente
        if (data.cliente_tipo_documento !== undefined)
          facturaData.cliente_tipo_documento = data.cliente_tipo_documento;
        if (data.cliente_numero_documento !== undefined)
          facturaData.cliente_numero_documento = data.cliente_numero_documento;
        if (data.cliente_denominacion !== undefined)
          facturaData.cliente_denominacion = data.cliente_denominacion;
        if (data.cliente_direccion !== undefined)
          facturaData.cliente_direccion = data.cliente_direccion;
        if (data.cliente_email !== undefined)
          facturaData.cliente_email = data.cliente_email;
        if (data.cliente_email_1 !== undefined)
          facturaData.cliente_email_1 = data.cliente_email_1;
        if (data.cliente_email_2 !== undefined)
          facturaData.cliente_email_2 = data.cliente_email_2;

        // Fechas (soporta DD-MM-YYYY y YYYY-MM-DD)
        if (data.fecha_emision !== undefined)
          facturaData.fecha_emision = this.parseDate(data.fecha_emision) || new Date();
        if (data.fecha_vencimiento !== undefined)
          facturaData.fecha_vencimiento = this.parseDate(data.fecha_vencimiento);
        if (data.fecha_servicio !== undefined)
          facturaData.fecha_servicio = this.parseDate(data.fecha_servicio);

        // Totales
        if (data.moneda !== undefined) facturaData.moneda = data.moneda;
        if (data.tipo_cambio !== undefined)
          facturaData.tipo_cambio = data.tipo_cambio;
        if (data.porcentaje_igv !== undefined)
          facturaData.porcentaje_igv = data.porcentaje_igv;
        if (data.total !== undefined) facturaData.total = data.total;
        if (data.total_gravada !== undefined)
          facturaData.total_gravada = data.total_gravada;
        if (data.total_igv !== undefined)
          facturaData.total_igv = data.total_igv;

        // ... mapear resto de campos según se necesite

        // Forma de pago
        if (data.condiciones_de_pago !== undefined)
          facturaData.condiciones_de_pago = data.condiciones_de_pago;
        if (data.medio_de_pago !== undefined)
          facturaData.medio_de_pago = data.medio_de_pago;

        if (data.observaciones !== undefined)
          facturaData.observaciones = data.observaciones;

        // Resetear estado a NULL para que vuelva a procesarse
        facturaData.estado_factura = null;
        facturaData.enlace = null;
        facturaData.enlace_del_pdf = null;
        facturaData.enlace_del_xml = null;
        facturaData.enlace_del_cdr = null;
        facturaData.sunat_description = null;
        facturaData.sunat_note = null;
        facturaData.sunat_responsecode = null;
        facturaData.sunat_soap_error = null;

        const facturaActualizada = await tx.factura.update({
          where: { id_factura },
          data: facturaData,
        });

        // Si se proporcionaron items, reemplazarlos
        if (data.items) {
          // Eliminar items existentes
          await tx.factura_item.deleteMany({
            where: { id_factura },
          });

          // Crear nuevos items
          if (data.items.length > 0) {
            await Promise.all(
              data.items.map((item: any) =>
                tx.factura_item.create({
                  data: {
                    id_factura,
                    codigo_item: item.codigo_item,
                    codigo_producto_sunat: item.codigo_producto_sunat,
                    descripcion_item: item.descripcion_item,
                    unidad_medida: this.mapearUnidadMedidaSunat(item.unidad_medida),
                    cantidad: item.cantidad,
                    valor_unitario: item.valor_unitario,
                    precio_unitario: item.precio_unitario,
                    descuento: item.descuento,
                    subtotal: item.subtotal,
                    tipo_de_igv: item.tipo_de_igv,
                    igv: item.igv,
                    tipo_de_isc: item.tipo_de_isc,
                    isc: item.isc,
                    total: item.total,
                    anticipo_regularizacion:
                      item.anticipo_regularizacion || false,
                    anticipo_documento_serie: item.anticipo_documento_serie,
                    anticipo_documento_numero: item.anticipo_documento_numero,
                  },
                }),
              ),
            );
          }
        }

        // Si se proporcionaron guías, reemplazarlas
        if (data.guias) {
          await tx.factura_guia.deleteMany({
            where: { id_factura },
          });

          if (data.guias.length > 0) {
            await Promise.all(
              data.guias.map((guia: any) =>
                tx.factura_guia.create({
                  data: {
                    id_factura,
                    guia_tipo: guia.guia_tipo,
                    guia_serie_numero: guia.guia_serie_numero,
                  },
                }),
              ),
            );
          }
        }

        // Si se proporcionaron cuotas, reemplazarlas (soporta ambos nombres)
        const cuotasCreditoUpdate = data.venta_al_credito || data.cuotas_credito;
        if (cuotasCreditoUpdate) {
          await tx.factura_venta_credito.deleteMany({
            where: { id_factura },
          });

          if (cuotasCreditoUpdate.length > 0) {
            await Promise.all(
              cuotasCreditoUpdate.map((cuota: any) =>
                tx.factura_venta_credito.create({
                  data: {
                    id_factura,
                    cuota: cuota.cuota,
                    fecha_pago: this.parseDate(cuota.fecha_de_pago || cuota.fecha_pago) || new Date(),
                    importe: cuota.importe,
                  },
                }),
              ),
            );
          }
        }

        return facturaActualizada;
      });

      this.logger.log(`Factura ${id} actualizada exitosamente`);

      // Retornar la factura actualizada con sus relaciones
      const facturaCompleta = await this.prisma.factura.findUnique({
        where: { id_factura },
        include: {
          factura_item: true,
          factura_guia: true,
          factura_venta_credito: true,
          proveedores: {
            select: {
              id_proveedor: true,
              nombre_proveedor: true,
              ruc: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Factura actualizada exitosamente',
        data: facturaCompleta,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(`Error actualizando factura ${id}:`, error);
      throw new HttpException(
        error.message || 'Error actualizando factura',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * DELETE /facturas/:id
   * Elimina una factura (solo si está en estado NULL o FALLADO)
   */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      // Verificar que la factura existe y está en estado eliminable
      const factura = await this.prisma.factura.findUnique({
        where: { id_factura: parseInt(id) },
      });

      if (!factura) {
        throw new HttpException('Factura no encontrada', HttpStatus.NOT_FOUND);
      }

      if (
        factura.estado_factura !== null &&
        factura.estado_factura !== 'FALLADO'
      ) {
        throw new HttpException(
          'No se puede eliminar una factura en estado ' +
            factura.estado_factura,
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.prisma.factura.delete({
        where: { id_factura: parseInt(id) },
      });

      return {
        message: 'Factura eliminada exitosamente',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(`Error eliminando factura ${id}:`, error);
      throw new HttpException(
        'Error eliminando factura',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /facturas/:id/consultar
   * Consulta una factura en NubeFact
   */
  @Post(':id/consultar')
  async consultarEnNubefact(@Param('id') id: string) {
    try {
      const id_factura = parseInt(id);
      this.logger.log(`Consultando factura ${id} en NubeFact...`);

      // 1. Obtener la factura de la base de datos
      const factura = await this.prisma.factura.findUnique({
        where: { id_factura },
        include: {
          factura_item: true,
          proveedores: true,
        },
      });

      if (!factura) {
        throw new HttpException('Factura no encontrada', HttpStatus.NOT_FOUND);
      }

      // 2. Llamar a NubeFact para consultar el comprobante
      const resultado = await this.facturaConsumer.callNubefactConsultarComprobante(
        factura.tipo_de_comprobante,
        factura.serie,
        factura.numero,
      );

      if (!resultado.success) {
        this.logger.error('Error consultando en NubeFact:', resultado.error);

        // Actualizar estado a ERROR si la consulta falla
        await this.prisma.factura.update({
          where: { id_factura },
          data: {
            estado_factura: 'ERROR',
            sunat_description: resultado.error?.data?.errors || 'Error al consultar en NubeFact',
          },
        });

        throw new HttpException(
          resultado.error?.data?.errors || 'Error al consultar en NubeFact',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 3. Actualizar la factura con los datos obtenidos de NubeFact
      const datosNubefact = resultado.data;

      const updateData: any = {
        updated_at: new Date(),
      };

      // Si la consulta fue exitosa y tiene enlaces, actualizar
      if (datosNubefact.enlace_del_pdf) {
        updateData.enlace_del_pdf = datosNubefact.enlace_del_pdf;
      }

      if (datosNubefact.enlace_del_xml) {
        updateData.enlace_del_xml = datosNubefact.enlace_del_xml;
      }

      if (datosNubefact.enlace_del_cdr) {
        updateData.enlace_del_cdr = datosNubefact.enlace_del_cdr;
      }

      if (datosNubefact.enlace) {
        updateData.enlace = datosNubefact.enlace;
      }

      // Actualizar estado según respuesta de SUNAT
      if (datosNubefact.aceptada_por_sunat !== undefined) {
        updateData.aceptada_por_sunat = datosNubefact.aceptada_por_sunat;
      }

      if (datosNubefact.sunat_description) {
        updateData.sunat_description = datosNubefact.sunat_description;
      }

      if (datosNubefact.sunat_note) {
        updateData.sunat_note = datosNubefact.sunat_note;
      }

      if (datosNubefact.sunat_responsecode) {
        updateData.sunat_responsecode = datosNubefact.sunat_responsecode;
      }

      // Determinar el estado final
      if (datosNubefact.enlace_del_pdf && datosNubefact.aceptada_por_sunat) {
        updateData.estado_factura = 'COMPLETADO';
      } else if (datosNubefact.aceptada_por_sunat === false) {
        updateData.estado_factura = 'FALLADO';
      } else {
        updateData.estado_factura = 'PROCESANDO';
      }

      // Actualizar en la base de datos
      const facturaActualizada = await this.prisma.factura.update({
        where: { id_factura },
        data: updateData,
      });

      // Emitir evento WebSocket para actualizar el frontend en tiempo real
      this.websocketGateway.emitFacturaUpdate({
        id_factura: factura.id_factura,
        estado: facturaActualizada.estado_factura || 'SIN PROCESAR',
        enlace_pdf: facturaActualizada.enlace_del_pdf || undefined,
        enlace_xml: facturaActualizada.enlace_del_xml || undefined,
        enlace_cdr: facturaActualizada.enlace_del_cdr || undefined,
        aceptada_por_sunat: facturaActualizada.aceptada_por_sunat ?? undefined,
      });

      this.logger.log(
        `Factura ${factura.serie}-${factura.numero} consultada exitosamente. Estado: ${updateData.estado_factura}`,
      );

      return {
        success: true,
        message: 'Consulta realizada exitosamente',
        data: {
          estado: updateData.estado_factura,
          enlace_pdf: datosNubefact.enlace_del_pdf,
          enlace_xml: datosNubefact.enlace_del_xml,
          enlace_cdr: datosNubefact.enlace_del_cdr,
          aceptada_por_sunat: datosNubefact.aceptada_por_sunat,
          sunat_description: datosNubefact.sunat_description,
          sunat_note: datosNubefact.sunat_note,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(`Error consultando factura ${id}:`, error);
      throw new HttpException(
        error.message || 'Error consultando factura en NubeFact',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
