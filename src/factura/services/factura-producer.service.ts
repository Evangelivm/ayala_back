import { Injectable, Logger } from '@nestjs/common';
import { KafkaService } from '../../kafka/kafka.service';

@Injectable()
export class FacturaProducerService {
  private readonly logger = new Logger(FacturaProducerService.name);

  constructor(private readonly kafkaService: KafkaService) {}

  /**
   * Envía una factura validada al topic factura-requests
   * @param recordId - ID del registro en BD
   * @param nubefactData - Datos transformados para NUBEFACT
   */
  async sendFacturaRequest(recordId: number, nubefactData: any): Promise<void> {
    try {
      const messageId = `factura-${recordId}-${Date.now()}`;

      await this.kafkaService.sendMessage({
        topic: 'factura-requests',
        key: String(recordId),
        value: JSON.stringify({
          messageId,
          recordId,
          nubefactData,
          timestamp: new Date().toISOString(),
        }),
      });

      this.logger.log(
        `Factura ${recordId} enviada a Kafka (msgId: ${messageId})`,
      );
    } catch (error) {
      this.logger.error(
        `Error enviando factura ${recordId} a Kafka:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Envía una factura al topic de procesamiento
   * @param recordId - ID del registro en BD
   * @param messageId - ID del mensaje
   */
  async sendToProcessing(recordId: number, messageId: string): Promise<void> {
    try {
      await this.kafkaService.sendMessage({
        topic: 'factura-processing',
        key: String(recordId),
        value: JSON.stringify({
          messageId,
          recordId,
          status: 'processing',
          timestamp: new Date().toISOString(),
        }),
      });

      this.logger.log(`Factura ${recordId} movida a processing`);
    } catch (error) {
      this.logger.error(
        `Error enviando factura ${recordId} a processing:`,
        error,
      );
    }
  }

  /**
   * Envía la respuesta de NUBEFACT al topic de respuestas
   * @param messageId - ID del mensaje original
   * @param recordId - ID del registro en BD
   * @param response - Respuesta de NUBEFACT
   * @param status - Estado de la respuesta ('success' o 'error')
   */
  async sendResponse(
    messageId: string,
    recordId: number,
    response: any,
    status: 'success' | 'error' = 'success',
  ): Promise<void> {
    try {
      await this.kafkaService.sendMessage({
        topic: 'factura-responses',
        key: String(recordId),
        value: JSON.stringify({
          messageId,
          recordId,
          status,
          response,
          timestamp: new Date().toISOString(),
        }),
      });

      this.logger.log(`Respuesta de factura ${recordId} enviada a topic (status: ${status})`);
    } catch (error) {
      this.logger.error(
        `Error enviando respuesta de factura ${recordId}:`,
        error,
      );
    }
  }

  /**
   * Envía una factura fallida al topic de fallidos
   * @param messageId - ID del mensaje original
   * @param recordId - ID del registro en BD
   * @param error - Información del error
   */
  async sendToFailed(
    messageId: string,
    recordId: number,
    error: any,
  ): Promise<void> {
    try {
      await this.kafkaService.sendMessage({
        topic: 'factura-failed',
        key: String(recordId),
        value: JSON.stringify({
          messageId,
          recordId,
          status: 'failed',
          error,
          timestamp: new Date().toISOString(),
        }),
      });

      this.logger.log(`Factura ${recordId} marcada como fallida`);
    } catch (error) {
      this.logger.error(
        `Error enviando factura ${recordId} a failed:`,
        error,
      );
    }
  }

  /**
   * Reintenta enviar un mensaje fallido
   * @param recordId - ID del registro en BD
   * @param retryCount - Número de reintentos
   */
  async retryFailedMessage(
    recordId: number,
    retryCount: number,
  ): Promise<void> {
    // TODO: Implementar lógica de reintento
    this.logger.log(`Reintentando factura ${recordId} (intento ${retryCount})`);
  }
}
