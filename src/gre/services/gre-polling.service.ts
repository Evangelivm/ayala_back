import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { GreProducerService } from './gre-producer.service';
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
export class GrePollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GrePollingService.name);
  private activeTasks = new Map<string, PollingTask>();

  private readonly POLLING_INTERVAL = 30000; // 30 segundos
  private readonly MAX_ATTEMPTS = 720; // 6 horas máximo (720 * 30seg = 6h)

  constructor(
    private readonly greProducer: GreProducerService,
    private readonly prismaService: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async onModuleInit() {
    // Recuperar pollings pendientes al iniciar
    await this.recoverPendingPollings();
  }

  async onModuleDestroy() {
    // Detener todos los pollings activos (pero mantener estado en BD)
    this.logger.log(`Deteniendo ${this.activeTasks.size} pollings activos antes de shutdown...`);
    for (const [recordId] of this.activeTasks) {
      await this.stopPolling(recordId, false); // false = no limpiar de BD
    }
  }

  /**
   * Recupera pollings pendientes desde la BD al reiniciar el servicio
   */
  async recoverPendingPollings(): Promise<void> {
    try {
      this.logger.log('🔄 Recuperando pollings pendientes desde la base de datos...');

      // Buscar registros en estado PROCESANDO
      const processingRecords = await this.prismaService.guia_remision.findMany({
        where: {
          estado_gre: 'PROCESANDO',
        },
      });

      if (processingRecords.length === 0) {
        this.logger.log('No hay pollings pendientes para recuperar');
        return;
      }

      this.logger.log(`Encontrados ${processingRecords.length} pollings pendientes para recuperar`);

      for (const record of processingRecords) {
        try {
          // Reconstruir nubefactData necesario para polling
          const nubefactData = {
            tipo_de_comprobante: record.tipo_de_comprobante,
            serie: record.serie,
            numero: record.numero,
          };

          // Generar nuevo messageId para el polling recuperado
          const messageId = `recovered-${record.id_guia}-${Date.now()}`;

          this.logger.log(`Recuperando polling para registro ${record.id_guia} (${record.serie}-${record.numero})`);

          // Reiniciar polling
          await this.startPolling(
            record.id_guia.toString(),
            messageId,
            nubefactData,
            true // isRecovery = true
          );

        } catch (error) {
          this.logger.error(`Error recuperando polling para registro ${record.id_guia}:`, error);
        }
      }

      this.logger.log(`✅ Recuperación completada: ${this.activeTasks.size} pollings activos`);

    } catch (error) {
      this.logger.error('Error en recuperación de pollings pendientes:', error);
    }
  }

  async startPolling(recordId: string, messageId: string, nubefactData: any, isRecovery: boolean = false): Promise<void> {
    try {
      // Si ya existe polling para este registro, detenerlo primero
      if (this.activeTasks.has(recordId)) {
        await this.stopPolling(recordId);
      }

      this.logger.log(`${isRecovery ? '🔄 Recuperando' : 'Iniciando'} polling persistente para registro ${recordId}`);

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

      // Ejecutar primera consulta inmediatamente
      setTimeout(() => this.executePolling(recordId), isRecovery ? 2000 : 1000);

      this.logger.log(`Polling ${isRecovery ? 'recuperado' : 'iniciado'} para registro ${recordId}, verificando cada ${this.POLLING_INTERVAL}ms`);

    } catch (error) {
      this.logger.error(`Error iniciando polling para registro ${recordId}:`, error);
      throw error;
    }
  }

  async stopPolling(recordId: string, cleanupFromDb: boolean = true): Promise<void> {
    const task = this.activeTasks.get(recordId);

    if (task) {
      clearInterval(task.intervalId);
      this.activeTasks.delete(recordId);

      const duration = Date.now() - task.startTime.getTime();
      this.logger.log(`Polling detenido para registro ${recordId} después de ${duration}ms, ${task.attemptCount} intentos`);

      // Si cleanupFromDb = false, mantener el estado PROCESANDO en BD
      // Esto permite recuperar el polling después de reiniciar
      if (!cleanupFromDb) {
        this.logger.debug(`Estado de BD mantenido para registro ${recordId} (recuperable al reiniciar)`);
      }
    }
  }

  private async executePolling(recordId: string): Promise<void> {
    const task = this.activeTasks.get(recordId);

    if (!task) {
      this.logger.warn(`No se encontró task de polling para registro ${recordId}`);
      return;
    }

    try {
      task.attemptCount++;

      this.logger.debug(`Ejecutando consultar_guia para registro ${recordId}, intento ${task.attemptCount}/${task.maxAttempts}`);

      // Llamar a la API consultar_guia
      const result = await this.callNubefactConsultarGuia(task.nubefactData);

      if (result.success && result.data) {
        const { enlace_del_pdf, enlace_del_xml, enlace_del_cdr, aceptada_por_sunat, sunat_description } = result.data;

        // Verificar que la guía fue aceptada por SUNAT
        if (aceptada_por_sunat !== true || sunat_description !== 'ACEPTADA') {
          this.logger.warn(`Registro ${recordId}: Guía NO aceptada por SUNAT (aceptada: ${aceptada_por_sunat}, descripción: ${sunat_description})`);

          await this.greProducer.sendResponse(
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

        // Verificar si tenemos todos los enlaces válidos (no null, no vacío)
        if (this.hasValidLinks(enlace_del_pdf, enlace_del_xml, enlace_del_cdr)) {
          this.logger.log(`✅ Enlaces completos obtenidos para registro ${recordId}`);

          // 🔥 NUEVO: Actualizar BD inmediatamente
          const guiaCompletada = await this.prismaService.guia_remision.update({
            where: { id_guia: parseInt(recordId) },
            data: {
              estado_gre: 'COMPLETADO',
              enlace_del_pdf: enlace_del_pdf,
              enlace_del_xml: enlace_del_xml,
              enlace_del_cdr: enlace_del_cdr
            }
          });

          // 🔥 NUEVO: Emitir WebSocket INMEDIATAMENTE (sin esperar Kafka)
          if (guiaCompletada.identificador_unico) {
            // Buscar el ID de programacion_tecnica correspondiente
            const programacionTecnica = await this.prismaService.programacion_tecnica.findFirst({
              where: { identificador_unico: guiaCompletada.identificador_unico },
              select: { id: true }
            });

            if (programacionTecnica) {
              this.websocketGateway.emitProgTecnicaCompletada({
                id: programacionTecnica.id,
                identificador_unico: guiaCompletada.identificador_unico
              });
              this.logger.log(`📡 WebSocket emitido directamente desde polling para: ${guiaCompletada.identificador_unico} (ID prog_tecnica: ${programacionTecnica.id})`);
            } else {
              this.logger.warn(`⚠️ No se encontró programacion_tecnica con identificador_unico: ${guiaCompletada.identificador_unico}`);
            }
          }

          // Enviar respuesta a Kafka (para logging/auditoría)
          await this.greProducer.sendResponse(
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

          // Detener polling
          await this.stopPolling(recordId);

          return;
        } else {
          this.logger.debug(`Registro ${recordId}: enlaces aún no disponibles (pdf: ${!!enlace_del_pdf}, xml: ${!!enlace_del_xml}, cdr: ${!!enlace_del_cdr})`);
        }

      } else {
        this.logger.debug(`Registro ${recordId}: respuesta de API sin datos completos`);
      }

      // Verificar si se alcanzó el máximo de intentos
      if (task.attemptCount >= task.maxAttempts) {
        this.logger.error(`⏰ Máximo de intentos alcanzado para registro ${recordId} (${task.maxAttempts} intentos en ${Date.now() - task.startTime.getTime()}ms)`);

        await this.greProducer.sendResponse(
          task.messageId,
          recordId,
          { error: 'Timeout: No se pudieron obtener los enlaces después de múltiples intentos' },
          'error'
        );

        await this.stopPolling(recordId);
      }

    } catch (error) {
      this.logger.error(`Error en polling para registro ${recordId}:`, error);

      // En caso de error, continuar polling hasta alcanzar máximo de intentos
      if (task.attemptCount >= task.maxAttempts) {
        await this.greProducer.sendResponse(
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

      // Extraer datos necesarios para consultar_guia
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
        timeout: 15000 // 15 segundos para consultas
      });

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      // No logear como error cada consulta fallida, es normal durante el polling
      if (error.response?.status === 404 || error.response?.status === 202) {
        // Estados esperados durante el polling
        return {
          success: false,
          data: null,
          waiting: true
        };
      }

      this.logger.debug(`Error en consultar_guia (se reintentará):`, error.message);

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

  // Métodos de utilidad para monitoreo

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
      this.logger.log(`Forzando verificación de polling para registro ${recordId}`);
      await this.executePolling(recordId);
    } else {
      this.logger.warn(`No hay polling activo para registro ${recordId}`);
    }
  }

  // Método para ajustar configuración de polling (útil para testing)
  updatePollingConfig(interval?: number, maxAttempts?: number): void {
    if (interval) {
      // @ts-ignore - Modificar configuración en tiempo de ejecución
      this.POLLING_INTERVAL = interval;
    }
    if (maxAttempts) {
      // @ts-ignore - Modificar configuración en tiempo de ejecución
      this.MAX_ATTEMPTS = maxAttempts;
    }

    this.logger.log(`Configuración de polling actualizada: ${this.POLLING_INTERVAL}ms intervalo, ${this.MAX_ATTEMPTS} max intentos`);
  }

  // Cleanup de tasks huérfanas
  async cleanupOrphanedTasks(): Promise<void> {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    for (const [recordId, task] of this.activeTasks) {
      const age = now - task.startTime.getTime();

      if (age > maxAge) {
        this.logger.warn(`Limpiando task huérfana para registro ${recordId} (${age}ms de antigüedad)`);
        await this.stopPolling(recordId);
      }
    }
  }
}