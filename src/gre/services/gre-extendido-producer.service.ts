import { Injectable, Logger } from '@nestjs/common';
import { KafkaService } from '../../kafka/kafka.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GreExtendidoProducerService {
  private readonly logger = new Logger(GreExtendidoProducerService.name);

  constructor(private readonly kafkaService: KafkaService) {}

  async sendGreRequest(recordId: string, greData: any): Promise<void> {
    try {
      this.logger.log(`Enviando GRE Extendido request para registro ${recordId}`);

      const validatedData = greData;

      // Crear mensaje Kafka
      const message = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        recordId: recordId,
        data: validatedData
      };

      console.log('🚀 [KAFKA-PRODUCER-EXTENDIDO] Mensaje completo a enviar a Kafka:', JSON.stringify(message, null, 2));

      // Enviar a topic gre-extendido-requests
      await this.kafkaService.sendMessage({
        topic: 'gre-extendido-requests',
        key: recordId,
        value: JSON.stringify(message),
      });

      this.logger.log(`GRE Extendido request enviado exitosamente para registro ${recordId}, mensaje ID: ${message.id}`);
    } catch (error) {
      this.logger.error(`Error enviando GRE Extendido request para registro ${recordId}:`, error);
      throw error;
    }
  }

  async sendToProcessing(messageId: string, recordId: string, greData: any): Promise<void> {
    try {
      const message = {
        id: messageId,
        recordId: recordId,
        timestamp: new Date().toISOString(),
        data: greData,
        status: 'processing'
      };

      await this.kafkaService.sendMessage({
        topic: 'gre-extendido-processing',
        key: recordId,
        value: JSON.stringify(message),
      });

      this.logger.log(`Mensaje ${messageId} movido a gre-extendido-processing`);
    } catch (error) {
      this.logger.error(`Error enviando a processing:`, error);
      throw error;
    }
  }

  async sendResponse(messageId: string, recordId: string, response: any, status: 'success' | 'error'): Promise<void> {
    try {
      const message = {
        id: messageId,
        recordId: recordId,
        timestamp: new Date().toISOString(),
        status: status,
        nubefact_response: status === 'success' ? response : null,
        error: status === 'error' ? response.error || response.message || 'Error desconocido' : null
      };

      await this.kafkaService.sendMessage({
        topic: 'gre-extendido-responses',
        key: recordId,
        value: JSON.stringify(message),
      });

      this.logger.log(`Respuesta enviada para mensaje ${messageId}, estado: ${status}`);
    } catch (error) {
      this.logger.error(`Error enviando respuesta:`, error);
      throw error;
    }
  }

  async sendToFailed(messageId: string, recordId: string, error: any, originalData?: any): Promise<void> {
    try {
      const message = {
        id: messageId,
        recordId: recordId,
        timestamp: new Date().toISOString(),
        error: error.message || error.toString(),
        errorStack: error.stack,
        originalData: originalData,
        retryCount: 0
      };

      await this.kafkaService.sendMessage({
        topic: 'gre-extendido-failed',
        key: recordId,
        value: JSON.stringify(message),
      });

      this.logger.log(`Mensaje ${messageId} enviado a gre-extendido-failed`);
    } catch (error) {
      this.logger.error(`Error enviando a failed topic:`, error);
      throw error;
    }
  }

  async sendBatchGreRequests(requests: Array<{ recordId: string, greData: any }>): Promise<void> {
    try {
      this.logger.log(`Enviando lote de ${requests.length} GRE Extendido requests`);

      const messages = requests.map(({ recordId, greData }) => {
        return {
          topic: 'gre-extendido-requests',
          key: recordId,
          value: JSON.stringify({
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            recordId: recordId,
            data: greData
          })
        };
      });

      await this.kafkaService.sendMessages(messages);

      this.logger.log(`Lote de ${requests.length} GRE Extendido requests enviado exitosamente`);
    } catch (error) {
      this.logger.error('Error enviando lote de GRE Extendido requests:', error);
      throw error;
    }
  }
}
