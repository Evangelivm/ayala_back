import { Injectable, Logger } from '@nestjs/common';
import { KafkaService } from '../../kafka/kafka.service';
import { GreValidationSchema, type GreValidationData } from '../schemas/gre-validation.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GreProducerService {
  private readonly logger = new Logger(GreProducerService.name);

  constructor(private readonly kafkaService: KafkaService) {}

  async sendGreRequest(recordId: string, greData: GreValidationData): Promise<void> {
    try {
      this.logger.log(`Enviando GRE request para registro ${recordId}`);

      // ⚠️ VALIDACIÓN DESACTIVADA PARA GRE - Schema configurado para facturas
      // TODO: Crear GreValidationSchema específico para tipos 7 y 8
      // const validatedData = GreValidationSchema.parse(greData);
      const validatedData = greData;

      // Crear mensaje Kafka
      const message = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        recordId: recordId,
        data: validatedData
      };

      console.log('🚀 [KAFKA-PRODUCER] Mensaje completo a enviar a Kafka:', JSON.stringify(message, null, 2));
      console.log('🚀 [KAFKA-PRODUCER] Data validada:', JSON.stringify(validatedData, null, 2));

      // Enviar a topic gre-requests
      await this.kafkaService.sendMessage({
        topic: 'gre-requests',
        key: recordId,
        value: JSON.stringify(message),
      });

      this.logger.log(`GRE request enviado exitosamente para registro ${recordId}, mensaje ID: ${message.id}`);
    } catch (error) {
      this.logger.error(`Error enviando GRE request para registro ${recordId}:`, error);

      if (error.name === 'ZodError') {
        this.logger.error('Errores de validación:', error.errors);
      }

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
        topic: 'gre-processing',
        key: recordId,
        value: JSON.stringify(message),
      });

      this.logger.log(`Mensaje ${messageId} movido a gre-processing`);
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
        topic: 'gre-responses',
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
        topic: 'gre-failed',
        key: recordId,
        value: JSON.stringify(message),
      });

      this.logger.log(`Mensaje ${messageId} enviado a gre-failed`);
    } catch (error) {
      this.logger.error(`Error enviando a failed topic:`, error);
      throw error;
    }
  }

  async retryFailedMessage(messageId: string, recordId: string, greData: any): Promise<void> {
    try {
      this.logger.log(`Reintentando mensaje fallido ${messageId} para registro ${recordId}`);

      const retryMessage = {
        id: uuidv4(), // Nuevo ID para el retry
        originalId: messageId,
        recordId: recordId,
        timestamp: new Date().toISOString(),
        data: greData,
        isRetry: true
      };

      await this.kafkaService.sendMessage({
        topic: 'gre-requests',
        key: recordId,
        value: JSON.stringify(retryMessage),
      });

      this.logger.log(`Retry enviado para mensaje ${messageId}`);
    } catch (error) {
      this.logger.error(`Error en retry:`, error);
      throw error;
    }
  }

  // Método para estadísticas y monitoreo
  async getProducerStats() {
    // Aquí podrías agregar lógica para obtener estadísticas
    // Por ejemplo, contadores de mensajes enviados, errores, etc.
    return {
      messagesProduced: 0, // Implementar contadores reales
      errors: 0,
      lastMessageTime: new Date().toISOString()
    };
  }

  // Método de utilidad para validar datos antes del envío
  private validateGreData(greData: any): GreValidationData {
    try {
      return GreValidationSchema.parse(greData);
    } catch (error) {
      this.logger.error('Error de validación en datos GRE:', error);
      throw new Error(`Datos GRE inválidos: ${error.message}`);
    }
  }

  // Método para envío en lote (útil para múltiples registros)
  async sendBatchGreRequests(requests: Array<{ recordId: string, greData: GreValidationData }>): Promise<void> {
    try {
      this.logger.log(`Enviando lote de ${requests.length} GRE requests`);

      const messages = requests.map(({ recordId, greData }) => {
        const validatedData = this.validateGreData(greData);

        return {
          topic: 'gre-requests',
          key: recordId,
          value: JSON.stringify({
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            recordId: recordId,
            data: validatedData
          })
        };
      });

      await this.kafkaService.sendMessages(messages);

      this.logger.log(`Lote de ${requests.length} GRE requests enviado exitosamente`);
    } catch (error) {
      this.logger.error('Error enviando lote de GRE requests:', error);
      throw error;
    }
  }
}