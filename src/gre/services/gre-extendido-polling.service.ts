import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { GreExtendidoProducerService } from './gre-extendido-producer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import axios from 'axios';

interface PollingTask {
  recordId: string;
  messageId: string;
  nubefactData: any;
  intervalId: NodeJS.Timeout;
  startTime: Date;
  attemptCount: number;
  maxAttempts: number;
}

@Injectable()
export class GreExtendidoPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GreExtendidoPollingService.name);
  private activeTasks = new Map<string, PollingTask>();

  private readonly POLLING_INTERVAL = 30000; // 30 segundos
  private readonly MAX_ATTEMPTS = 720; // 6 horas máximo

  constructor(
    private readonly greExtendidoProducer: GreExtendidoProducerService,
    private readonly prismaService: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async onModuleInit() {
    await this.recoverPendingPollings();
  }

  async onModuleDestroy() {
    this.logger.log(`Deteniendo ${this.activeTasks.size} pollings extendidos activos antes de shutdown...`);
    for (const [recordId] of this.activeTasks) {
      await this.stopPolling(recordId, false);
    }
  }

  async recoverPendingPollings(): Promise<void> {
    try {
      this.logger.log('🔄 Recuperando pollings extendidos pendientes desde la base de datos...');

      const processingRecords = await this.prismaService.guia_remision_extendido.findMany({
        where: {
          estado_gre: 'PROCESANDO',
        },
      });

      if (processingRecords.length === 0) {
        this.logger.log('No hay pollings extendidos pendientes para recuperar');
        return;
      }

      this.logger.log(`Encontrados ${processingRecords.length} pollings extendidos pendientes para recuperar`);

      for (const record of processingRecords) {
        try {
          const nubefactData = {
            tipo_de_comprobante: record.tipo_de_comprobante,
            serie: record.serie,
            numero: record.numero,
          };

          const messageId = `recovered-extendido-${record.id_guia}-${Date.now()}`;

          this.logger.log(`Recuperando polling extendido para registro ${record.id_guia} (${record.serie}-${record.numero})`);

          await this.startPolling(
            record.id_guia.toString(),
            messageId,
            nubefactData,
            true
          );

        } catch (error) {
          this.logger.error(`Error recuperando polling extendido para registro ${record.id_guia}:`, error);
        }
      }

      this.logger.log(`✅ Recuperación extendida completada: ${this.activeTasks.size} pollings activos`);

    } catch (error) {
      this.logger.error('Error en recuperación de pollings extendidos pendientes:', error);
    }
  }

  async startPolling(recordId: string, messageId: string, nubefactData: any, isRecovery: boolean = false): Promise<void> {
    try {
      if (this.activeTasks.has(recordId)) {
        await this.stopPolling(recordId);
      }

      this.logger.log(`${isRecovery ? '🔄 Recuperando' : 'Iniciando'} polling extendido persistente para registro ${recordId}`);

      const intervalId = setInterval(async () => {
        await this.executePolling(recordId);
      }, this.POLLING_INTERVAL);

      const task: PollingTask = {
        recordId,
        messageId,
        nubefactData,
        intervalId,
        startTime: new Date(),
        attemptCount: 0,
        maxAttempts: this.MAX_ATTEMPTS
      };

      this.activeTasks.set(recordId, task);

      setTimeout(() => this.executePolling(recordId), isRecovery ? 2000 : 1000);

      this.logger.log(`Polling extendido ${isRecovery ? 'recuperado' : 'iniciado'} para registro ${recordId}`);

    } catch (error) {
      this.logger.error(`Error iniciando polling extendido para registro ${recordId}:`, error);
      throw error;
    }
  }

  async stopPolling(recordId: string, cleanupFromDb: boolean = true): Promise<void> {
    const task = this.activeTasks.get(recordId);

    if (task) {
      clearInterval(task.intervalId);
      this.activeTasks.delete(recordId);

      const duration = Date.now() - task.startTime.getTime();
      this.logger.log(`Polling extendido detenido para registro ${recordId} después de ${duration}ms, ${task.attemptCount} intentos`);

      if (!cleanupFromDb) {
        this.logger.debug(`Estado de BD mantenido para registro extendido ${recordId}`);
      }
    }
  }

  private async executePolling(recordId: string): Promise<void> {
    const task = this.activeTasks.get(recordId);

    if (!task) {
      this.logger.warn(`No se encontró task extendida de polling para registro ${recordId}`);
      return;
    }

    try {
      task.attemptCount++;

      this.logger.debug(`Ejecutando consultar_guia extendida para registro ${recordId}, intento ${task.attemptCount}/${task.maxAttempts}`);

      const result = await this.callNubefactConsultarGuia(task.nubefactData);

      if (result.success && result.data) {
        const { enlace_del_pdf, enlace_del_xml, enlace_del_cdr, aceptada_por_sunat, sunat_description } = result.data;

        if (aceptada_por_sunat !== true || sunat_description !== 'ACEPTADA') {
          this.logger.warn(`Registro extendido ${recordId}: Guía NO aceptada por SUNAT (aceptada: ${aceptada_por_sunat}, descripción: ${sunat_description})`);

          await this.greExtendidoProducer.sendResponse(
            task.messageId,
            recordId,
            {
              error: `Guía rechazada por SUNAT: ${sunat_description}`,
              sunat_response: result.data
            },
            'error'
          );

          await this.stopPolling(recordId);
          return;
        }

        if (this.hasValidLinks(enlace_del_pdf, enlace_del_xml, enlace_del_cdr)) {
          this.logger.log(`✅ Enlaces completos obtenidos para registro extendido ${recordId}`);

          // Actualizar BD inmediatamente
          const guiaCompletada = await this.prismaService.guia_remision_extendido.update({
            where: { id_guia: parseInt(recordId) },
            data: {
              estado_gre: 'COMPLETADO',
              enlace_del_pdf: enlace_del_pdf,
              enlace_del_xml: enlace_del_xml,
              enlace_del_cdr: enlace_del_cdr
            }
          });

          // Emitir WebSocket inmediatamente
          if (guiaCompletada.identificador_unico) {
            const programacionTecnica = await this.prismaService.programacion_tecnica.findFirst({
              where: { identificador_unico: guiaCompletada.identificador_unico },
              select: { id: true }
            });

            if (programacionTecnica) {
              this.websocketGateway.emitProgTecnicaCompletada({
                id: programacionTecnica.id,
                identificador_unico: guiaCompletada.identificador_unico,
                pdf_link: enlace_del_pdf,
                xml_link: enlace_del_xml,
                cdr_link: enlace_del_cdr
              });
              this.logger.log(`📡 WebSocket emitido desde polling extendido para: ${guiaCompletada.identificador_unico}`);
            } else {
              this.logger.warn(`⚠️ No se encontró programacion_tecnica para identificador extendido: ${guiaCompletada.identificador_unico}`);
            }
          }

          // Enviar respuesta a Kafka
          await this.greExtendidoProducer.sendResponse(
            task.messageId,
            recordId,
            {
              ...result.data,
              pdf_url: enlace_del_pdf,
              xml_url: enlace_del_xml,
              cdr_url: enlace_del_cdr
            },
            'success'
          );

          await this.stopPolling(recordId);

          return;
        } else {
          this.logger.debug(`Registro extendido ${recordId}: enlaces aún no disponibles`);
        }

      } else {
        this.logger.debug(`Registro extendido ${recordId}: respuesta de API sin datos completos`);
      }

      if (task.attemptCount >= task.maxAttempts) {
        this.logger.error(`⏰ Máximo de intentos alcanzado para registro extendido ${recordId}`);

        await this.greExtendidoProducer.sendResponse(
          task.messageId,
          recordId,
          { error: 'Timeout: No se pudieron obtener los enlaces después de múltiples intentos' },
          'error'
        );

        await this.stopPolling(recordId);
      }

    } catch (error) {
      this.logger.error(`Error en polling extendido para registro ${recordId}:`, error);

      if (task.attemptCount >= task.maxAttempts) {
        await this.greExtendidoProducer.sendResponse(
          task.messageId,
          recordId,
          { error: `Error persistente en polling: ${error.message}` },
          'error'
        );

        await this.stopPolling(recordId);
      }
    }
  }

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

  private async callNubefactConsultarGuia(nubefactData: any) {
    try {
      const NUBEFACT_CONSULTAR_URL = process.env.NUBEFACT_CONSULTAR_URL || 'https://api.nubefact.com/authorization/consultar';
      const NUBEFACT_TOKEN = process.env.NUBEFACT_TOKEN;

      if (!NUBEFACT_TOKEN) {
        throw new Error('NUBEFACT_TOKEN no configurado');
      }

      const consultaData = {
        operacion: 'consultar_guia',
        tipo_de_comprobante: nubefactData.tipo_de_comprobante || 9,
        serie: nubefactData.serie,
        numero: nubefactData.numero
      };

      const response = await axios.post(NUBEFACT_CONSULTAR_URL, consultaData, {
        headers: {
          'Authorization': `Token ${NUBEFACT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      if (error.response?.status === 404 || error.response?.status === 202) {
        return {
          success: false,
          data: null,
          waiting: true
        };
      }

      this.logger.debug(`Error en consultar_guia extendida (se reintentará):`, error.message);

      return {
        success: false,
        error: {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        }
      };
    }
  }

  getActivePollingCount(): number {
    return this.activeTasks.size;
  }

  getPollingStats() {
    const stats: Array<{
      recordId: string;
      messageId: string;
      startTime: Date;
      runTime: number;
      attemptCount: number;
      maxAttempts: number;
      progress: string;
    }> = [];

    for (const [recordId, task] of this.activeTasks) {
      const runTime = Date.now() - task.startTime.getTime();
      stats.push({
        recordId,
        messageId: task.messageId,
        startTime: task.startTime,
        runTime,
        attemptCount: task.attemptCount,
        maxAttempts: task.maxAttempts,
        progress: (task.attemptCount / task.maxAttempts * 100).toFixed(1) + '%'
      });
    }

    return {
      activeCount: this.activeTasks.size,
      tasks: stats,
      pollingInterval: this.POLLING_INTERVAL,
      maxAttempts: this.MAX_ATTEMPTS
    };
  }

  async forceCheckPolling(recordId: string): Promise<void> {
    const task = this.activeTasks.get(recordId);

    if (task) {
      this.logger.log(`Forzando verificación de polling extendido para registro ${recordId}`);
      await this.executePolling(recordId);
    } else {
      this.logger.warn(`No hay polling extendido activo para registro ${recordId}`);
    }
  }
}
