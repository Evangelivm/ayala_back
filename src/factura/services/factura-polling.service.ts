import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaThirdService } from '../../prisma/prisma-third.service';
import { FacturaProducerService } from './factura-producer.service';
import axios from 'axios';

interface PollingTaskInfo {
  recordId: number;
  messageId: string;
  nubefactData: any;
  attempts: number;
  startedAt: Date;
  timeoutHandle?: NodeJS.Timeout;
}

@Injectable()
export class FacturaPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FacturaPollingService.name);
  private readonly POLLING_INTERVAL = 30000; // 30 segundos
  private readonly MAX_ATTEMPTS = 720; // 6 horas (720 * 30s)
  private activePollingTasks = new Map<number, PollingTaskInfo>();

  constructor(
    private readonly prisma: PrismaThirdService,
    private readonly producerService: FacturaProducerService,
  ) {}

  async onModuleInit() {
    this.logger.log('Servicio de polling inicializado');
    // Recuperar pollings pendientes al iniciar
    await this.recoverPendingPollings();
  }

  async onModuleDestroy() {
    // Detener todos los pollings activos (pero mantener estado en BD)
    this.logger.log(
      `Deteniendo ${this.activePollingTasks.size} pollings activos antes de shutdown...`,
    );
    for (const [recordId] of this.activePollingTasks) {
      await this.stopPolling(recordId, false); // false = no limpiar de BD
    }
  }

  /**
   * Inicia el polling para una factura que está en proceso
   * @param recordId - ID del registro en BD
   * @param messageId - ID del mensaje de Kafka
   * @param nubefactData - Datos enviados a NUBEFACT
   * @param isRecovery - Si es una recuperación después de reinicio
   */
  async startPolling(
    recordId: number,
    messageId: string,
    nubefactData: any,
    isRecovery = false,
  ): Promise<void> {
    // Verificar si ya existe polling para este registro
    if (this.activePollingTasks.has(recordId)) {
      this.logger.warn(`Ya existe polling activo para factura ${recordId}`);
      return;
    }

    const taskInfo: PollingTaskInfo = {
      recordId,
      messageId,
      nubefactData,
      attempts: 0,
      startedAt: new Date(),
    };

    this.activePollingTasks.set(recordId, taskInfo);

    if (isRecovery) {
      this.logger.log(`Recuperando polling para factura ${recordId}`);
    } else {
      this.logger.log(`Iniciando polling para factura ${recordId}`);
    }

    // Ejecutar el primer polling inmediatamente
    await this.executePolling(recordId);
  }

  /**
   * Ejecuta un intento de polling para consultar el estado en NUBEFACT
   * @param recordId - ID del registro en BD
   */
  private async executePolling(recordId: number): Promise<void> {
    const taskInfo = this.activePollingTasks.get(recordId);
    if (!taskInfo) {
      this.logger.warn(`No se encontró task info para factura ${recordId}`);
      return;
    }

    try {
      taskInfo.attempts++;
      this.logger.debug(
        `Polling factura ${recordId} (intento ${taskInfo.attempts}/${this.MAX_ATTEMPTS})`,
      );

      // Obtener datos de la factura desde BD para construir la consulta
      const facturaRecord = await this.prisma.factura.findUnique({
        where: { id_factura: recordId },
      });

      if (!facturaRecord) {
        this.logger.error(`Factura ${recordId} no encontrada en BD`);
        await this.stopPolling(recordId);
        return;
      }

      // Verificar si el estado cambió (puede haber sido completada manualmente)
      if (facturaRecord.estado_factura === 'COMPLETADO') {
        this.logger.log(`Factura ${recordId} ya completada, deteniendo polling`);
        await this.stopPolling(recordId);
        return;
      }

      if (facturaRecord.estado_factura === 'FALLADO') {
        this.logger.log(`Factura ${recordId} marcada como fallada, deteniendo polling`);
        await this.stopPolling(recordId);
        return;
      }

      // Llamar a la API consultar_comprobante
      const result = await this.callNubefactConsultarComprobante(
        facturaRecord.tipo_de_comprobante || 1,
        facturaRecord.serie,
        facturaRecord.numero,
      );

      if (result.success && result.data) {
        const {
          enlace_del_pdf,
          enlace_del_xml,
          enlace_del_cdr,
          aceptada_por_sunat,
          sunat_description,
        } = result.data;

        // Verificar que el comprobante fue aceptado por SUNAT
        if (aceptada_por_sunat !== true || sunat_description !== 'ACEPTADA') {
          this.logger.warn(
            `Factura ${recordId}: Comprobante NO aceptado por SUNAT (aceptada: ${aceptada_por_sunat}, descripción: ${sunat_description})`,
          );

          await this.producerService.sendResponse(
            taskInfo.messageId,
            recordId,
            {
              error: `Comprobante rechazado por SUNAT: ${sunat_description}`,
              sunat_response: result.data,
            },
            'error',
          );

          await this.stopPolling(recordId);
          return;
        }

        // Verificar si tenemos todos los enlaces válidos
        if (this.hasValidLinks(enlace_del_pdf, enlace_del_xml, enlace_del_cdr)) {
          this.logger.log(`✅ Enlaces completos obtenidos para factura ${recordId}`);

          // Enviar respuesta exitosa
          await this.producerService.sendResponse(
            taskInfo.messageId,
            recordId,
            result.data,
            'success',
          );

          // Detener polling
          await this.stopPolling(recordId);
          return;
        } else {
          this.logger.debug(
            `Factura ${recordId}: enlaces aún no disponibles (pdf: ${!!enlace_del_pdf}, xml: ${!!enlace_del_xml}, cdr: ${!!enlace_del_cdr})`,
          );
        }
      } else {
        this.logger.debug(
          `Factura ${recordId}: respuesta de API sin datos completos`,
        );
      }

      // Verificar si se alcanzó el máximo de intentos
      if (taskInfo.attempts >= this.MAX_ATTEMPTS) {
        this.logger.error(
          `⏰ Máximo de intentos alcanzado para factura ${recordId} (${this.MAX_ATTEMPTS} intentos)`,
        );
        await this.handlePollingTimeout(recordId);
        return;
      }

      // Programar próximo intento
      taskInfo.timeoutHandle = setTimeout(() => {
        this.executePolling(recordId);
      }, this.POLLING_INTERVAL);
    } catch (error) {
      this.logger.error(`Error en polling de factura ${recordId}:`, error);

      // Verificar si se alcanzó el máximo de intentos
      if (taskInfo.attempts >= this.MAX_ATTEMPTS) {
        await this.producerService.sendResponse(
          taskInfo.messageId,
          recordId,
          { error: `Error persistente en polling: ${error.message}` },
          'error',
        );
        await this.stopPolling(recordId);
        return;
      }

      // Programar reintento
      taskInfo.timeoutHandle = setTimeout(() => {
        this.executePolling(recordId);
      }, this.POLLING_INTERVAL);
    }
  }

  /**
   * Detiene el polling para una factura
   * @param recordId - ID del registro en BD
   * @param cleanupFromDb - Si debe limpiar el estado en BD
   */
  async stopPolling(recordId: number, cleanupFromDb = true): Promise<void> {
    const taskInfo = this.activePollingTasks.get(recordId);
    if (!taskInfo) {
      return;
    }

    // Cancelar timeout si existe
    if (taskInfo.timeoutHandle) {
      clearTimeout(taskInfo.timeoutHandle);
    }

    this.activePollingTasks.delete(recordId);
    this.logger.log(`Polling detenido para factura ${recordId}`);

    if (cleanupFromDb) {
      // TODO: Limpiar estado en BD si es necesario
    }
  }

  /**
   * Maneja el timeout de polling (alcanzó máximo de intentos)
   * @param recordId - ID del registro en BD
   */
  private async handlePollingTimeout(recordId: number): Promise<void> {
    const taskInfo = this.activePollingTasks.get(recordId);
    if (!taskInfo) {
      return;
    }

    this.logger.error(
      `Timeout de polling para factura ${recordId} después de ${taskInfo.attempts} intentos`,
    );

    // Enviar a topic failed con error de timeout
    await this.producerService.sendResponse(
      taskInfo.messageId,
      recordId,
      {
        error:
          'Timeout: No se pudieron obtener los enlaces después de múltiples intentos',
      },
      'error',
    );

    // Actualizar estado en BD a FALLADO
    await this.prisma.factura.update({
      where: { id_factura: recordId },
      data: {
        estado_factura: 'FALLADO',
        sunat_soap_error: JSON.stringify({
          error: 'Timeout en polling',
          attempts: taskInfo.attempts,
        }),
      },
    });

    await this.stopPolling(recordId, false);
  }

  /**
   * Recupera pollings pendientes después de un reinicio
   */
  private async recoverPendingPollings(): Promise<void> {
    try {
      this.logger.log('🔄 Recuperando pollings pendientes desde la base de datos...');

      // Buscar facturas con estado PROCESANDO
      const processingRecords = await this.prisma.factura.findMany({
        where: {
          estado_factura: 'PROCESANDO',
        },
      });

      if (processingRecords.length === 0) {
        this.logger.log('No hay pollings pendientes para recuperar');
        return;
      }

      this.logger.log(
        `Encontrados ${processingRecords.length} pollings pendientes para recuperar`,
      );

      for (const record of processingRecords) {
        try {
          // Reconstruir nubefactData necesario para polling
          const nubefactData = {
            tipo_de_comprobante: record.tipo_de_comprobante,
            serie: record.serie,
            numero: record.numero,
          };

          // Generar nuevo messageId para el polling recuperado
          const messageId = `recovered-${record.id_factura}-${Date.now()}`;

          this.logger.log(
            `Recuperando polling para factura ${record.id_factura} (${record.serie}-${record.numero})`,
          );

          // Reiniciar polling
          await this.startPolling(
            record.id_factura,
            messageId,
            nubefactData,
            true, // isRecovery = true
          );
        } catch (error) {
          this.logger.error(
            `Error recuperando polling para factura ${record.id_factura}:`,
            error,
          );
        }
      }

      this.logger.log(
        `✅ Recuperación completada: ${this.activePollingTasks.size} pollings activos`,
      );
    } catch (error) {
      this.logger.error('Error recuperando pollings pendientes:', error);
    }
  }

  /**
   * Obtiene el número de pollings activos
   */
  getActivePollingCount(): number {
    return this.activePollingTasks.size;
  }

  /**
   * Obtiene estadísticas del servicio de polling
   */
  getPollingStats() {
    return {
      activePollings: this.activePollingTasks.size,
      tasks: Array.from(this.activePollingTasks.values()).map((task) => ({
        recordId: task.recordId,
        attempts: task.attempts,
        startedAt: task.startedAt,
        elapsedMinutes: Math.floor(
          (Date.now() - task.startedAt.getTime()) / 60000,
        ),
      })),
    };
  }

  /**
   * Fuerza la verificación de una factura específica
   * @param recordId - ID del registro en BD
   */
  async forceCheckPolling(recordId: number): Promise<void> {
    this.logger.log(`Verificación forzada de polling para factura ${recordId}`);
    await this.executePolling(recordId);
  }

  /**
   * Limpia tareas huérfanas (más de 24 horas)
   */
  async cleanupOrphanedTasks(): Promise<void> {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    for (const [recordId, task] of this.activePollingTasks.entries()) {
      const age = now - task.startedAt.getTime();
      if (age > maxAge) {
        this.logger.warn(
          `Limpiando tarea huérfana para factura ${recordId} (${Math.floor(age / 3600000)}h)`,
        );
        await this.stopPolling(recordId);
      }
    }
  }

  /**
   * Llama a la API de NUBEFACT para consultar comprobante
   * @param tipo - Tipo de comprobante
   * @param serie - Serie del comprobante
   * @param numero - Número del comprobante
   * @returns Respuesta de NUBEFACT
   */
  private async callNubefactConsultarComprobante(
    tipo: number,
    serie: string,
    numero: number,
  ): Promise<any> {
    try {
      const NUBEFACT_CONSULTA_URL =
        process.env.NUBEFACT_CONSULTA_URL ||
        'https://api.nubefact.com/api/v1/consultar';
      const NUBEFACT_TOKEN = process.env.NUBEFACT_TOKEN;

      if (!NUBEFACT_TOKEN) {
        throw new Error('NUBEFACT_TOKEN no configurado');
      }

      const consultaData = {
        operacion: 'consultar_comprobante',
        tipo_de_comprobante: tipo,
        serie: serie,
        numero: numero,
      };

      this.logger.debug(
        `Consultando comprobante: tipo=${tipo}, serie=${serie}, numero=${numero}`,
      );

      const response = await axios.post(NUBEFACT_CONSULTA_URL, consultaData, {
        headers: {
          Authorization: `Token ${NUBEFACT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000, // 15 segundos para consultas
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      // No logear como error cada consulta fallida, es normal durante el polling
      if (error.response?.status === 404 || error.response?.status === 202) {
        // Estados esperados durante el polling
        return {
          success: false,
          data: null,
          waiting: true,
        };
      }

      this.logger.debug(`Error en consultar_comprobante (se reintentará):`, error.message);

      return {
        success: false,
        error: {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
        },
      };
    }
  }

  /**
   * Valida que los enlaces estén completos y no vacíos
   */
  private hasValidLinks(pdf_url: any, xml_url: any, cdr_url: any): boolean {
    return !!(
      pdf_url &&
      pdf_url !== null &&
      pdf_url.toString().trim() !== '' &&
      xml_url &&
      xml_url !== null &&
      xml_url.toString().trim() !== '' &&
      cdr_url &&
      cdr_url !== null &&
      cdr_url.toString().trim() !== ''
    );
  }
}
