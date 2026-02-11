import { Injectable, Logger, Controller } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  KafkaContext,
} from '@nestjs/microservices';
import { KafkaService } from '../../kafka/kafka.service';
import { PrismaThirdService } from '../../prisma/prisma-third.service';
import { FacturaProducerService } from './factura-producer.service';
import { FacturaPollingService } from './factura-polling.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import axios from 'axios';

@Controller() // ✅ Necesario para @MessagePattern
@Injectable() // ✅ Necesario para inyección de dependencias
export class FacturaConsumerService {
  private readonly logger = new Logger(FacturaConsumerService.name);

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly prisma: PrismaThirdService,
    private readonly facturaProducer: FacturaProducerService,
    private readonly facturaPolling: FacturaPollingService,
    private readonly websocketGateway: WebsocketGateway,
  ) {
    this.logger.log('FacturaConsumerService initialized');
  }

  /**
   * Consume mensajes del topic factura-requests
   * Llama a NUBEFACT para generar el comprobante
   */
  @MessagePattern('factura-requests')
  async handleFacturaRequest(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    try {
      this.logger.log(
        `📥 Mensaje recibido de factura-requests: ${JSON.stringify(message).substring(0, 100)}...`,
      );

      const { messageId, recordId, nubefactData } = message;

      this.logger.log(
        `Procesando factura request: ${messageId} para registro ${recordId}`,
      );

      // ✅ VERIFICAR ESTADO ANTES DE PROCESAR (deduplicación)
      const currentRecord = await this.prisma.factura.findUnique({
        where: { id_factura: parseInt(recordId) },
      });

      if (!currentRecord) {
        this.logger.error(`Registro ${recordId} no encontrado en BD`);
        return;
      }

      // Si ya está en PROCESANDO, COMPLETADO o FALLADO, ignorar (ya fue procesado)
      if (currentRecord.estado_factura !== 'PENDIENTE') {
        this.logger.warn(
          `⚠️ Registro ${recordId} ya fue procesado (estado: ${currentRecord.estado_factura}), ignorando mensaje duplicado`,
        );
        return;
      }

      // Actualizar estado en BD a PROCESANDO
      await this.prisma.factura.update({
        where: { id_factura: parseInt(recordId) },
        data: { estado_factura: 'PROCESANDO' },
      });

      // Llamar API generar comprobante de NUBEFACT
      const nubefactResponse =
        await this.callNubefactGenerarComprobante(nubefactData);

      if (nubefactResponse.success) {
        this.logger.log(
          `API generar comprobante exitosa para registro ${recordId}`,
        );

        const responseData = nubefactResponse.data;

        // Verificar si la respuesta YA contiene todos los enlaces
        if (responseData.enlace_del_pdf && responseData.enlace_del_xml) {
          this.logger.log(
            `✅ Respuesta de Nubefact contiene enlaces completos, guardando inmediatamente`,
          );

          // Guardar inmediatamente en la BD
          await this.prisma.factura.update({
            where: { id_factura: parseInt(recordId) },
            data: {
              estado_factura: 'COMPLETADO',
              enlace: responseData.enlace || null,
              enlace_del_pdf: responseData.enlace_del_pdf,
              enlace_del_xml: responseData.enlace_del_xml,
              enlace_del_cdr: responseData.enlace_del_cdr || null,
              aceptada_por_sunat: responseData.aceptada_por_sunat || null,
              sunat_description: responseData.sunat_description || null,
              sunat_note: responseData.sunat_note || null,
              sunat_responsecode: responseData.sunat_responsecode || null,
              sunat_soap_error: responseData.sunat_soap_error || null,
            },
          });

          this.logger.log(`Factura ${recordId} completada inmediatamente`);

          // Emitir evento WebSocket para notificar al frontend (no bloqueante)
          try {
            this.websocketGateway.emitFacturaUpdate({
              id_factura: parseInt(recordId),
              estado: 'COMPLETADO',
              enlace_pdf: responseData.enlace_del_pdf,
              enlace_xml: responseData.enlace_del_xml,
              enlace_cdr: responseData.enlace_del_cdr,
            });
          } catch (wsError) {
            this.logger.warn(
              `Error emitiendo WebSocket (no crítico):`,
              wsError,
            );
          }
        } else {
          // Si no tiene enlaces, iniciar polling
          this.logger.log(
            `⏳ Respuesta sin enlaces completos, iniciando polling`,
          );

          // Mover a topic processing para iniciar polling
          await this.facturaProducer.sendToProcessing(recordId, messageId);

          // Iniciar polling persistente
          await this.facturaPolling.startPolling(
            recordId,
            messageId,
            responseData,
          );
        }
      } else {
        this.logger.error(
          `Error en API generar comprobante para registro ${recordId}:`,
          nubefactResponse.error,
        );

        // Actualizar a FALLADO con información del error
        await this.prisma.factura.update({
          where: { id_factura: parseInt(recordId) },
          data: {
            estado_factura: 'FALLADO',
            sunat_soap_error: JSON.stringify(nubefactResponse.error),
          },
        });

        // Emitir evento WebSocket para notificar al frontend (no bloqueante)
        try {
          this.websocketGateway.emitFacturaUpdate({
            id_factura: parseInt(recordId),
            estado: 'FALLADO',
          });
        } catch (wsError) {
          this.logger.warn(`Error emitiendo WebSocket (no crítico):`, wsError);
        }

        // Enviar a topic failed
        await this.facturaProducer.sendToFailed(
          messageId,
          recordId,
          nubefactResponse.error,
        );
      }
    } catch (error) {
      this.logger.error('Error procesando factura request:', error);

      // Extraer recordId del mensaje para actualizar estado
      try {
        if (message?.recordId) {
          await this.prisma.factura.update({
            where: { id_factura: parseInt(message.recordId) },
            data: {
              estado_factura: 'FALLADO',
              sunat_soap_error: JSON.stringify({
                message: error.message,
                stack: error.stack,
              }),
            },
          });
        }
      } catch (updateError) {
        this.logger.error('Error actualizando estado a FALLADO:', updateError);
      }
    }
  }

  /**
   * Consume mensajes del topic factura-processing
   * Monitorea el estado del polling
   */
  @MessagePattern('factura-processing')
  async handleFacturaProcessing(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    try {
      const { messageId, recordId } = message;

      this.logger.debug(
        `Procesando mensaje en processing: ${messageId} para registro ${recordId}`,
      );

      // Este consumer principalmente monitoreará el estado del polling
      // El polling real se maneja en FacturaPollingService

      // Verificar si el registro ya está COMPLETADO
      const record = await this.prisma.factura.findUnique({
        where: { id_factura: parseInt(recordId) },
      });

      if (record?.estado_factura === 'COMPLETADO') {
        this.logger.log(
          `Registro ${recordId} ya completado, deteniendo procesamiento`,
        );
        await this.facturaPolling.stopPolling(recordId);
      }
    } catch (error) {
      this.logger.error('Error procesando mensaje de processing:', error);
    }
  }

  /**
   * Consume mensajes del topic factura-responses
   * Actualiza BD con respuestas de NUBEFACT
   */
  @MessagePattern('factura-responses')
  async handleFacturaResponse(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    try {
      const { messageId, recordId, status, response } = message;

      this.logger.log(
        `Procesando respuesta: ${messageId} para registro ${recordId}, estado: ${status}`,
      );

      if (status === 'success' && response) {
        // Extraer enlaces y datos de SUNAT
        const {
          enlace,
          enlace_del_pdf,
          enlace_del_xml,
          enlace_del_cdr,
          aceptada_por_sunat,
          sunat_description,
          sunat_note,
          sunat_responsecode,
          sunat_soap_error,
        } = response;

        // Verificar si tenemos todos los enlaces necesarios
        if (enlace_del_pdf && enlace_del_xml) {
          // Actualizar BD con todos los datos
          await this.prisma.factura.update({
            where: { id_factura: parseInt(recordId) },
            data: {
              estado_factura: 'COMPLETADO',
              enlace: enlace || null,
              enlace_del_pdf: enlace_del_pdf,
              enlace_del_xml: enlace_del_xml,
              enlace_del_cdr: enlace_del_cdr || null,
              aceptada_por_sunat: aceptada_por_sunat || null,
              sunat_description: sunat_description || null,
              sunat_note: sunat_note || null,
              sunat_responsecode: sunat_responsecode || null,
              sunat_soap_error: sunat_soap_error || null,
            },
          });

          // Detener polling para este registro
          await this.facturaPolling.stopPolling(recordId);

          this.logger.log(
            `Registro ${recordId} completado con todos los datos`,
          );
        } else {
          this.logger.debug(
            `Registro ${recordId} aún sin todos los enlaces, continuando polling`,
          );
        }
      } else if (status === 'failed') {
        this.logger.error(
          `Error en respuesta para registro ${recordId}:`,
          message.error,
        );

        // Actualizar a FALLADO
        await this.prisma.factura.update({
          where: { id_factura: parseInt(recordId) },
          data: {
            estado_factura: 'FALLADO',
            sunat_soap_error: JSON.stringify(message.error),
          },
        });

        // Detener polling
        await this.facturaPolling.stopPolling(recordId);
      }
    } catch (error) {
      this.logger.error('Error procesando respuesta de factura:', error);
    }
  }

  /**
   * Llama a la API de NUBEFACT para generar comprobante
   * @param nubefactData - Datos en formato NUBEFACT
   * @returns Respuesta de NUBEFACT
   */
  private async callNubefactGenerarComprobante(nubefactData: any) {
    try {
      const NUBEFACT_API_URL_2 =
        process.env.NUBEFACT_API_URL_2 ||
        'https://api.nubefact.com/api/v1/generar_comprobante';
      const NUBEFACT_TOKEN_2 = process.env.NUBEFACT_TOKEN_2;

      if (!NUBEFACT_TOKEN_2) {
        throw new Error('NUBEFACT_TOKEN_2 no configurado');
      }

      this.logger.log('Llamando a NUBEFACT API generar_comprobante');

      const response = await axios.post(NUBEFACT_API_URL_2, nubefactData, {
        headers: {
          Authorization: `Token ${NUBEFACT_TOKEN_2}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error('Error en llamada a NUBEFACT:', error);

      // Log de las fechas enviadas cuando hay error
      this.logger.error('📅 Fechas enviadas a Nubefact que causaron el error:');
      this.logger.error(
        `  - fecha_de_emision: ${nubefactData.fecha_de_emision}`,
      );
      this.logger.error(
        `  - fecha_de_vencimiento: ${nubefactData.fecha_de_vencimiento}`,
      );
      this.logger.error(
        `  - fecha_de_servicio: ${nubefactData.fecha_de_servicio}`,
      );

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
   * Llama a la API de NUBEFACT para consultar comprobante
   * @param tipo - Tipo de comprobante
   * @param serie - Serie del comprobante
   * @param numero - Número del comprobante
   * @returns Respuesta de NUBEFACT
   */
  async callNubefactConsultarComprobante(
    tipo: number,
    serie: string,
    numero: number,
  ): Promise<any> {
    try {
      // URL correcta para consultar comprobantes (misma que GRE)
      const NUBEFACT_CONSULTA_URL =
        process.env.NUBEFACT_CONSULTAR_URL ||
        'https://api.nubefact.com/authorization/consultar';
      const NUBEFACT_TOKEN_2 = process.env.NUBEFACT_TOKEN_2;

      if (!NUBEFACT_TOKEN_2) {
        throw new Error('NUBEFACT_TOKEN_2 no configurado');
      }

      this.logger.log(
        `Consultando comprobante en ${NUBEFACT_CONSULTA_URL}: tipo=${tipo}, serie=${serie}, numero=${numero}`,
      );

      const response = await axios.post(
        NUBEFACT_CONSULTA_URL,
        {
          operacion: 'consultar_comprobante',
          tipo_de_comprobante: tipo,
          serie: serie,
          numero: numero,
        },
        {
          headers: {
            Authorization: `Token ${NUBEFACT_TOKEN_2}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000, // 15 segundos
        },
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error('Error consultando comprobante en NUBEFACT:', error);

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
   * Obtiene estadísticas del consumer
   */
  async getConsumerStats() {
    try {
      const estadoNull = await this.prisma.factura.count({
        where: { estado_factura: null },
      });

      const pendientes = await this.prisma.factura.count({
        where: { estado_factura: 'PENDIENTE' },
      });

      const procesando = await this.prisma.factura.count({
        where: { estado_factura: 'PROCESANDO' },
      });

      const completados = await this.prisma.factura.count({
        where: { estado_factura: 'COMPLETADO' },
      });

      const fallados = await this.prisma.factura.count({
        where: { estado_factura: 'FALLADO' },
      });

      const pollingActivos = await this.facturaPolling.getActivePollingCount();

      return {
        estadoNull,
        pendientes,
        procesando,
        completados,
        fallados,
        pollingActivos,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error obteniendo estadísticas del consumer:', error);
      throw error;
    }
  }

  /**
   * Método para reanudar procesamiento de registros fallidos
   */
  async retryFailedRecords(): Promise<void> {
    try {
      const failedRecords = await this.prisma.factura.findMany({
        where: { estado_factura: 'FALLADO' },
        take: 10, // Procesar de a 10
      });

      this.logger.log(
        `Reintentando ${failedRecords.length} registros fallidos`,
      );

      for (const record of failedRecords) {
        try {
          // Resetear estado a null para que sea detectado nuevamente
          await this.prisma.factura.update({
            where: { id_factura: record.id_factura },
            data: {
              estado_factura: null,
              enlace: null,
              enlace_del_pdf: null,
              enlace_del_xml: null,
              enlace_del_cdr: null,
              sunat_description: null,
              sunat_note: null,
              sunat_responsecode: null,
              sunat_soap_error: null,
            },
          });

          this.logger.log(
            `Registro ${record.id_factura} reseteado para reintento`,
          );
        } catch (error) {
          this.logger.error(
            `Error reseteando registro ${record.id_factura}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error en retry de registros fallidos:', error);
      throw error;
    }
  }
}
