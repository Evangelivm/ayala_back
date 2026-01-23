import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Consumer } from 'kafkajs';

export interface GreRequestMessage {
  id: string;
  timestamp: string;
  data: {
    operacion: 'generar_guia';
    tipo_de_comprobante: number;
    serie: string;
    numero: number;
    [key: string]: any;
  };
}

export interface GreResponseMessage {
  id: string;
  status: 'success' | 'error';
  nubefact_response?: {
    pdf_url: string;
    xml_url: string;
    cdr_url: string;
  };
  error?: string;
}

export interface KafkaMessage {
  topic: string;
  key?: string;
  value: string;
  partition?: number;
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private consumers: Map<string, Consumer> = new Map();

  constructor(
    @Inject('KAFKA_SERVICE') private kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.connectWithRetry();
  }

  private async connectWithRetry(maxRetries: number = 10): Promise<void> {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        this.logger.log(`Attempting to connect to Kafka (attempt ${retries + 1}/${maxRetries})`);

        // Conectar primero
        await this.kafkaClient.connect();
        this.logger.log('Kafka Client connected successfully');

        // Crear los topics específicos del plan GRE
        await this.createGreTopics();

        // Solo después de crear topics, suscribirse
        this.kafkaClient.subscribeToResponseOf('gre-requests');
        this.kafkaClient.subscribeToResponseOf('gre-processing');

        this.logger.log('Kafka initialization completed successfully');
        return;

      } catch (error) {
        retries++;
        this.logger.error(`Failed to connect to Kafka (attempt ${retries}/${maxRetries})`, error);

        if (retries >= maxRetries) {
          this.logger.error('Max connection retries reached. Kafka connection failed permanently.');
          throw new Error(`Failed to connect to Kafka after ${maxRetries} attempts: ${error.message}`);
        }

        const delay = Math.min(1000 * Math.pow(2, retries), 10000); // Exponential backoff, max 10 seconds
        this.logger.log(`Retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async onModuleDestroy() {
    try {
      await this.kafkaClient.close();
      this.logger.log('Kafka Client disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Kafka Client', error);
    }
  }

  private async createGreTopics() {
    try {
      const greTopics = [
        'gre-requests',
        'gre-processing',
        'gre-responses',
        'gre-failed',
        // ✅ Topics para GRE Extendido (duplicación masiva)
        'gre-extendido-requests',
        'gre-extendido-processing',
        'gre-extendido-responses',
        'gre-extendido-failed',
      ];

      this.logger.log(`Creating GRE Topics: ${greTopics.join(', ')}`);

      // Obtener el cliente Kafka interno para acceder al admin
      const kafka = this.kafkaClient['client'];
      if (!kafka) {
        throw new Error('Kafka client is not initialized');
      }
      const admin = kafka.admin();

      await admin.connect();

      // Verificar qué topics ya existen
      const existingTopics = await admin.listTopics();
      const topicsToCreate = greTopics.filter(topic => !existingTopics.includes(topic));

      if (topicsToCreate.length > 0) {
        this.logger.log(`Creating missing topics: ${topicsToCreate.join(', ')}`);

        await admin.createTopics({
          topics: topicsToCreate.map(topic => ({
            topic,
            numPartitions: 3,
            replicationFactor: 1,
            configEntries: [
              {
                name: 'cleanup.policy',
                value: 'delete'
              },
              {
                name: 'retention.ms',
                value: '604800000' // 7 days
              }
            ]
          }))
        });

        this.logger.log(`Successfully created topics: ${topicsToCreate.join(', ')}`);
      } else {
        this.logger.log('All GRE topics already exist');
      }

      await admin.disconnect();
    } catch (error) {
      this.logger.error('Error creating GRE topics', error);
      throw error;
    }
  }

  // Métodos específicos para el sistema GRE según el plan
  async sendGreRequest(greData: GreRequestMessage): Promise<void> {
    try {
      this.kafkaClient.emit('gre-requests', greData);
      this.logger.log(`GRE request sent: ${greData.id}`);
    } catch (error) {
      this.logger.error(`Failed to send GRE request: ${greData.id}`, error);
      throw error;
    }
  }

  async sendGreProcessing(greData: any): Promise<void> {
    try {
      this.kafkaClient.emit('gre-processing', greData);
      this.logger.log(`GRE processing message sent: ${greData.id}`);
    } catch (error) {
      this.logger.error(`Failed to send GRE processing: ${greData.id}`, error);
      throw error;
    }
  }

  async sendGreResponse(responseData: GreResponseMessage): Promise<void> {
    try {
      this.kafkaClient.emit('gre-responses', responseData);
      this.logger.log(`GRE response sent: ${responseData.id}`);
    } catch (error) {
      this.logger.error(`Failed to send GRE response: ${responseData.id}`, error);
      throw error;
    }
  }

  async sendGreFailed(failedData: any): Promise<void> {
    try {
      this.kafkaClient.emit('gre-failed', failedData);
      this.logger.log(`GRE failed message sent: ${failedData.id}`);
    } catch (error) {
      this.logger.error(`Failed to send GRE failed: ${failedData.id}`, error);
      throw error;
    }
  }

  // Método de compatibilidad para mensajes generales
  async sendMessage(message: KafkaMessage): Promise<void> {
    try {
      // El value ya viene como string JSON desde el producer
      // emit() de NestJS se encarga de la serialización automáticamente
      this.kafkaClient.emit(message.topic, message.value);
      this.logger.log(`Message sent to topic ${message.topic} with key ${message.key}`);
    } catch (error) {
      this.logger.error(
        `Failed to send message to topic ${message.topic}`,
        error,
      );
      throw error;
    }
  }

  async sendMessages(messages: KafkaMessage[]): Promise<void> {
    try {
      // Enviar mensajes individualmente usando el cliente NestJS
      for (const message of messages) {
        await this.sendMessage(message);
      }

      this.logger.log(`Batch of ${messages.length} messages sent`);
    } catch (error) {
      this.logger.error('Failed to send batch messages', error);
      throw error;
    }
  }

  // Métodos de utilidad para el sistema GRE
  getGreTopics(): string[] {
    return ['gre-requests', 'gre-processing', 'gre-responses', 'gre-failed'];
  }

  isGreTopic(topic: string): boolean {
    return this.getGreTopics().includes(topic);
  }

  // Acceso al cliente Kafka para uso avanzado si es necesario
  getKafkaClient(): ClientKafka {
    return this.kafkaClient;
  }

  // Métodos para manejo de consumers
  async createConsumer(
    groupId: string,
    topics: string[],
    messageHandler: (payload: any) => Promise<void>
  ): Promise<void> {
    try {
      // Para NestJS ClientKafka, usamos decoradores en lugar de crear consumers manualmente
      // Este método mantiene compatibilidad pero usa el patrón de NestJS
      this.logger.log(`Consumer ${groupId} configured for topics: ${topics.join(', ')}`);

      // Los consumers en NestJS se manejan mediante decoradores @MessagePattern
      // Esta implementación es para compatibilidad con el código existente
      for (const topic of topics) {
        this.kafkaClient.subscribeToResponseOf(topic);
      }
    } catch (error) {
      this.logger.error(`Failed to create consumer ${groupId}`, error);
      throw error;
    }
  }

  async stopConsumer(groupId: string): Promise<void> {
    try {
      this.logger.log(`Stopping consumer: ${groupId}`);
      // En NestJS ClientKafka, los consumers se manejan automáticamente
      // Esta implementación es para compatibilidad
      if (this.consumers.has(groupId)) {
        const consumer = this.consumers.get(groupId);
        await consumer?.disconnect();
        this.consumers.delete(groupId);
      }
    } catch (error) {
      this.logger.error(`Failed to stop consumer ${groupId}`, error);
    }
  }
}
