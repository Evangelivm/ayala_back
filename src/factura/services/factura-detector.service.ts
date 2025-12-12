import { Injectable, Logger } from '@nestjs/common';
import { PrismaThirdService } from '../../prisma/prisma-third.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacturaProducerService } from './factura-producer.service';
import { Decimal } from '@prisma/client/runtime/library';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class FacturaDetectorService {
  private readonly logger = new Logger(FacturaDetectorService.name);
  private stats = {
    totalDetected: 0,
    totalValidated: 0,
    totalFailed: 0,
    lastRun: null as Date | null,
  };

  constructor(
    private readonly prisma: PrismaThirdService,
    private readonly facturaProducer: FacturaProducerService,
  ) {}

  /**
   * Cron job que se ejecuta cada 30 segundos para detectar facturas
   * con estado NULL que estén completas y listas para enviar a NUBEFACT
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async detectCompleteRecords() {
    try {
      this.logger.debug('Detectando facturas completas...');
      this.stats.lastRun = new Date();

      // Buscar facturas con estado NULL
      const completeRecords = await this.prisma.factura.findMany({
        where: {
          estado_factura: null,
        },
        include: {
          factura_item: true,
          factura_guia: true,
          factura_venta_credito: true,
          proveedores: true,
        },
      });

      if (completeRecords.length > 0) {
        this.logger.log(
          `Encontradas ${completeRecords.length} facturas para validar`,
        );
        this.stats.totalDetected += completeRecords.length;

        for (const record of completeRecords) {
          try {
            // Validar que la factura esté completa y sea válida
            const validationResult = await this.validateFacturaRecord(record);

            if (validationResult.isValid) {
              await this.processCompleteRecord(record);
              this.stats.totalValidated++;
            } else {
              this.logger.debug(
                `Factura ${record.id_factura} no cumple validaciones: ${validationResult.errors.join(', ')}`,
              );
            }
          } catch (error) {
            this.logger.error(
              `Error procesando factura ${record.id_factura}:`,
              error,
            );
            this.stats.totalFailed++;
          }
        }
      } else {
        this.logger.debug('No se encontraron facturas pendientes');
      }
    } catch (error) {
      this.logger.error('Error en detección de facturas completas:', error);
    }
  }

  /**
   * Valida que un registro de factura esté completo y sea válido
   * @param record - Registro de factura de BD con sus relaciones
   * @returns Objeto con isValid y errores
   */
  private async validateFacturaRecord(record: any): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // 1. Validar operación
      if (!record.operacion || record.operacion !== 'generar_comprobante') {
        errors.push('operacion debe ser "generar_comprobante"');
      }

      // 2. Validar tipo de comprobante
      if (!record.tipo_de_comprobante || ![1, 2, 7, 8, 9, 13].includes(record.tipo_de_comprobante)) {
        errors.push('tipo_de_comprobante inválido');
      }

      // 3. Validar serie y número
      if (!record.serie || record.serie.length !== 4) {
        errors.push('serie debe tener 4 caracteres');
      }

      if (!record.numero || record.numero < 1) {
        errors.push('numero debe ser mayor a 0');
      }

      // 4. Validar serie según tipo de comprobante
      if (record.tipo_de_comprobante === 1 && !record.serie.startsWith('F')) {
        errors.push('Factura debe iniciar con F');
      } else if (record.tipo_de_comprobante === 2 && !record.serie.startsWith('B')) {
        errors.push('Boleta debe iniciar con B');
      } else if (record.tipo_de_comprobante === 7 && !record.serie.startsWith('FC')) {
        errors.push('Nota de Crédito debe iniciar con FC');
      } else if (record.tipo_de_comprobante === 8 && !record.serie.startsWith('FD')) {
        errors.push('Nota de Débito debe iniciar con FD');
      }

      // 5. Validar proveedor
      if (!record.proveedores) {
        errors.push('proveedor no encontrado');
      }

      // 6. Validar cliente
      if (!record.cliente_numero_documento) {
        errors.push('cliente_numero_documento es requerido');
      }
      if (!record.cliente_denominacion) {
        errors.push('cliente_denominacion es requerido');
      }

      // Validar tipo de documento cliente
      if (record.cliente_tipo_documento === 6 && record.cliente_numero_documento?.length !== 11) {
        errors.push('RUC debe tener 11 dígitos');
      } else if (record.cliente_tipo_documento === 1 && record.cliente_numero_documento?.length !== 8) {
        errors.push('DNI debe tener 8 dígitos');
      }

      // 7. Validar fechas
      if (!record.fecha_emision) {
        errors.push('fecha_emision es requerida');
      }

      // 8. Validar moneda
      if (!record.moneda || ![1, 2].includes(record.moneda)) {
        errors.push('moneda debe ser 1 (PEN) o 2 (USD)');
      }

      // 9. Validar totales
      if (!record.total || record.total <= 0) {
        errors.push('total debe ser mayor a 0');
      }

      if (record.porcentaje_igv && (record.porcentaje_igv < 0 || record.porcentaje_igv > 100)) {
        errors.push('porcentaje_igv inválido');
      }

      // 10. Validar items
      if (!record.factura_item || record.factura_item.length === 0) {
        errors.push('debe tener al menos 1 item');
      }

      // Validar cada item
      for (const item of record.factura_item || []) {
        if (!item.descripcion_item) {
          errors.push(`item ${item.id_factura_item}: falta descripcion_item`);
        }
        if (!item.unidad_medida) {
          errors.push(`item ${item.id_factura_item}: falta unidad_medida`);
        }
        if (!item.cantidad || item.cantidad <= 0) {
          errors.push(`item ${item.id_factura_item}: cantidad inválida`);
        }
        if (item.precio_unitario === undefined || item.precio_unitario < 0) {
          errors.push(`item ${item.id_factura_item}: precio_unitario inválido`);
        }
        if (!item.tipo_de_igv) {
          errors.push(`item ${item.id_factura_item}: falta tipo_de_igv`);
        }
      }

      // 11. Validar detracción si aplica
      if (record.aplicar_detraccion) {
        if (!record.detraccion_tipo) {
          errors.push('detraccion_tipo es requerido cuando aplica detracción');
        }
        if (!record.detraccion_porcentaje || record.detraccion_porcentaje <= 0) {
          errors.push('detraccion_porcentaje inválido');
        }
        if (!record.detraccion_total || record.detraccion_total <= 0) {
          errors.push('detraccion_total inválido');
        }
      }

      // 12. Validar totales coherentes (si están presentes)
      if (record.total_gravada !== null && record.total_gravada !== undefined) {
        const totalCalculado = this.decimalToNumber(record.total_gravada) +
                               this.decimalToNumber(record.total_igv || 0);
        const totalFactura = this.decimalToNumber(record.total);

        // Permitir diferencia de 0.01 por redondeos
        if (Math.abs(totalCalculado - totalFactura) > 0.01) {
          errors.push(`total inconsistente: calculado ${totalCalculado}, registrado ${totalFactura}`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      this.logger.error(
        `Error validando factura ${record.id_factura}:`,
        error,
      );
      return {
        isValid: false,
        errors: [`Error en validación: ${error.message}`],
      };
    }
  }

  /**
   * Procesa una factura completa y válida
   * @param record - Registro de factura validado
   */
  private async processCompleteRecord(record: any): Promise<void> {
    try {
      this.logger.log(
        `Procesando factura ${record.serie}-${record.numero} (ID: ${record.id_factura})`,
      );

      // Transformar al formato NUBEFACT
      const nubefactData = this.transformRecordToNubefactApi(record);

      // Enviar a Kafka
      await this.facturaProducer.sendFacturaRequest(
        record.id_factura,
        nubefactData,
      );

      // Actualizar estado a PENDIENTE
      await this.prisma.factura.update({
        where: { id_factura: record.id_factura },
        data: {
          estado_factura: 'PENDIENTE',
          updated_at: new Date(),
        },
      });

      this.logger.log(
        `Factura ${record.id_factura} enviada a Kafka exitosamente`,
      );
    } catch (error) {
      this.logger.error(
        `Error procesando factura ${record.id_factura}:`,
        error,
      );

      // Marcar como FALLADO si hay error
      try {
        await this.prisma.factura.update({
          where: { id_factura: record.id_factura },
          data: {
            estado_factura: 'FALLADO',
            sunat_soap_error: `Error en detección: ${error.message}`,
            updated_at: new Date(),
          },
        });
      } catch (updateError) {
        this.logger.error(
          `Error actualizando estado a FALLADO:`,
          updateError,
        );
      }

      throw error;
    }
  }

  /**
   * Transforma un registro de BD al formato esperado por NUBEFACT API
   * @param record - Registro de factura de BD
   * @returns Objeto en formato NUBEFACT
   */
  private transformRecordToNubefactApi(record: any): any {
    return {
      // Datos principales
      operacion: record.operacion,
      tipo_de_comprobante: record.tipo_de_comprobante,
      serie: record.serie,
      numero: record.numero,
      sunat_transaction: record.sunat_transaction,

      // Cliente
      cliente_tipo_de_documento: record.cliente_tipo_documento,
      cliente_numero_de_documento: record.cliente_numero_documento,
      cliente_denominacion: record.cliente_denominacion,
      cliente_direccion: record.cliente_direccion || undefined,
      cliente_email: record.cliente_email || undefined,
      cliente_email_1: record.cliente_email_1 || undefined,
      cliente_email_2: record.cliente_email_2 || undefined,

      // Fechas (formato DD-MM-YYYY)
      fecha_de_emision: this.formatDateForNubefact(record.fecha_emision),
      fecha_de_vencimiento: record.fecha_vencimiento
        ? this.formatDateForNubefact(record.fecha_vencimiento)
        : undefined,
      fecha_de_servicio: record.fecha_servicio
        ? this.formatDateForNubefact(record.fecha_servicio)
        : undefined,

      // Moneda
      moneda: record.moneda,
      tipo_de_cambio: record.tipo_cambio
        ? this.decimalToString(record.tipo_cambio)
        : undefined,
      porcentaje_de_igv: this.decimalToString(record.porcentaje_igv),

      // Totales (convertir Decimal a string)
      descuento_global: record.descuento_global
        ? this.decimalToString(record.descuento_global)
        : undefined,
      total_descuento: record.total_descuento
        ? this.decimalToString(record.total_descuento)
        : undefined,
      total_anticipo: record.total_anticipo
        ? this.decimalToString(record.total_anticipo)
        : undefined,
      total_gravada: record.total_gravada
        ? this.decimalToString(record.total_gravada)
        : undefined,
      total_inafecta: record.total_inafecta
        ? this.decimalToString(record.total_inafecta)
        : undefined,
      total_exonerada: record.total_exonerada
        ? this.decimalToString(record.total_exonerada)
        : undefined,
      total_igv: record.total_igv
        ? this.decimalToString(record.total_igv)
        : undefined,
      total_gratuita: record.total_gratuita
        ? this.decimalToString(record.total_gratuita)
        : undefined,
      total_otros_cargos: record.total_otros_cargos
        ? this.decimalToString(record.total_otros_cargos)
        : undefined,
      total_isc: record.total_isc
        ? this.decimalToString(record.total_isc)
        : undefined,
      total: this.decimalToString(record.total),

      // Detracción
      detraccion: record.aplicar_detraccion || undefined,
      detraccion_tipo: record.detraccion_tipo || undefined,
      detraccion_porcentaje: record.detraccion_porcentaje
        ? this.decimalToString(record.detraccion_porcentaje)
        : undefined,
      detraccion_total: record.detraccion_total
        ? this.decimalToString(record.detraccion_total)
        : undefined,
      medio_de_pago: record.medio_pago_detraccion || undefined,

      // Ubicaciones (para servicios de transporte)
      ubigeo_de_origen: record.ubigeo_origen || undefined,
      direccion_de_origen: record.direccion_origen || undefined,
      ubigeo_de_destino: record.ubigeo_destino || undefined,
      direccion_de_destino: record.direccion_destino || undefined,
      detalle_viaje: record.detalle_viaje || undefined,

      // Percepción
      percepcion_tipo: record.percepcion_tipo || undefined,
      percepcion_base_imponible: record.percepcion_base_imponible
        ? this.decimalToString(record.percepcion_base_imponible)
        : undefined,
      total_percepcion: record.total_percepcion
        ? this.decimalToString(record.total_percepcion)
        : undefined,
      total_incluido_percepcion: record.total_incluido_percepcion
        ? this.decimalToString(record.total_incluido_percepcion)
        : undefined,

      // Retención
      retencion_tipo: record.retencion_tipo || undefined,
      retencion_base_imponible: record.retencion_base_imponible
        ? this.decimalToString(record.retencion_base_imponible)
        : undefined,
      total_retencion: record.total_retencion
        ? this.decimalToString(record.total_retencion)
        : undefined,

      // Información adicional
      observaciones: record.observaciones || undefined,
      orden_compra_servicio: record.orden_compra_servicio || undefined,
      placa_vehiculo: record.placa_vehiculo || undefined,

      // Configuración de envío
      enviar_automaticamente_a_la_sunat: record.enviar_automaticamente_sunat,
      enviar_automaticamente_al_cliente: record.enviar_automaticamente_cliente,
      formato_de_pdf: record.formato_pdf || 'A4',

      // Items
      items: record.factura_item.map((item: any) => ({
        unidad_de_medida: item.unidad_medida,
        codigo: item.codigo_item || undefined,
        codigo_producto_sunat: item.codigo_producto_sunat || undefined,
        descripcion: item.descripcion_item,
        cantidad: this.decimalToNumber(item.cantidad),
        valor_unitario: this.decimalToNumber(item.valor_unitario),
        precio_unitario: this.decimalToNumber(item.precio_unitario),
        descuento: item.descuento
          ? this.decimalToNumber(item.descuento)
          : undefined,
        subtotal: this.decimalToNumber(item.subtotal),
        tipo_de_igv: item.tipo_de_igv,
        igv: this.decimalToNumber(item.igv),
        tipo_de_isc: item.tipo_de_isc || undefined,
        isc: item.isc ? this.decimalToNumber(item.isc) : undefined,
        total: this.decimalToNumber(item.total),
        anticipo_regularizacion: item.anticipo_regularizacion,
        anticipo_comprobante_serie: item.anticipo_documento_serie || undefined,
        anticipo_comprobante_numero: item.anticipo_documento_numero || undefined,
      })),

      // Guías relacionadas
      guias:
        record.factura_guia && record.factura_guia.length > 0
          ? record.factura_guia.map((guia: any) => ({
              guia_tipo: guia.guia_tipo,
              guia_serie_numero: guia.guia_serie_numero,
            }))
          : undefined,

      // Venta a crédito
      venta_al_credito:
        record.factura_venta_credito && record.factura_venta_credito.length > 0
          ? record.factura_venta_credito.map((cuota: any) => ({
              cuota: cuota.cuota,
              fecha_de_pago: this.formatDateForNubefact(cuota.fecha_pago),
              importe: this.decimalToNumber(cuota.importe),
            }))
          : undefined,
    };
  }

  /**
   * Formatea una fecha al formato DD-MM-YYYY requerido por NUBEFACT
   * Convierte la fecha del backend a timezone de Perú (America/Lima)
   * @param date - Fecha a formatear
   * @returns String en formato DD-MM-YYYY
   */
  private formatDateForNubefact(date: Date | string): string {
    // Convertir la fecha del backend a timezone de Perú (America/Lima)
    const peruDate = dayjs(date).tz('America/Lima');
    const day = String(peruDate.date()).padStart(2, '0');
    const month = String(peruDate.month() + 1).padStart(2, '0');
    const year = peruDate.year();
    return `${day}-${month}-${year}`;
  }

  /**
   * Convierte un Decimal de Prisma a string para NUBEFACT
   * @param value - Valor Decimal
   * @returns String con 2 decimales
   */
  private decimalToString(value: Decimal | number | null | undefined): string {
    if (value === null || value === undefined) return '0.00';
    const num = typeof value === 'number' ? value : parseFloat(value.toString());
    return num.toFixed(2);
  }

  /**
   * Convierte un Decimal de Prisma a number
   * @param value - Valor Decimal
   * @returns Number
   */
  private decimalToNumber(value: Decimal | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    return typeof value === 'number' ? value : parseFloat(value.toString());
  }

  /**
   * Fuerza la detección de una factura específica
   * @param id_factura - ID de la factura
   */
  async forceDetection(id_factura: number): Promise<void> {
    try {
      this.logger.log(`Detección forzada para factura ${id_factura}`);

      // Buscar la factura con sus relaciones
      const factura = await this.prisma.factura.findUnique({
        where: { id_factura },
        include: {
          factura_item: true,
          factura_guia: true,
          factura_venta_credito: true,
          proveedores: true,
        },
      });

      if (!factura) {
        throw new Error(`Factura ${id_factura} no encontrada`);
      }

      if (factura.estado_factura !== null && factura.estado_factura !== 'FALLADO') {
        throw new Error(
          `Factura ${id_factura} está en estado ${factura.estado_factura}, solo se puede forzar NULL o FALLADO`,
        );
      }

      // Validar y procesar
      const validationResult = await this.validateFacturaRecord(factura);

      if (!validationResult.isValid) {
        throw new Error(
          `Factura ${id_factura} no es válida: ${validationResult.errors.join(', ')}`,
        );
      }

      await this.processCompleteRecord(factura);

      this.logger.log(`Factura ${id_factura} procesada exitosamente`);
    } catch (error) {
      this.logger.error(`Error en detección forzada de factura ${id_factura}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas del servicio de detección
   */
  async getDetectionStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [pendingCount, validatedToday, failedToday] = await Promise.all([
      this.prisma.factura.count({
        where: { estado_factura: null },
      }),
      this.prisma.factura.count({
        where: {
          estado_factura: 'PENDIENTE',
          updated_at: { gte: today },
        },
      }),
      this.prisma.factura.count({
        where: {
          estado_factura: 'FALLADO',
          updated_at: { gte: today },
        },
      }),
    ]);

    return {
      pending: pendingCount,
      validatedToday,
      failedToday,
      stats: this.stats,
    };
  }
}
