import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaService } from './kafka.service';

@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: ['161.132.54.103:9092'],
            connectionTimeout: 3000,
            authenticationTimeout: 1000,
            reauthenticationThreshold: 10000,
            requestTimeout: 30000,
            retry: {
              initialRetryTime: 100,
              retries: 8,
              maxRetryTime: 30000,
            },
          },
          consumer: {
            groupId: 'ayala-gre-consumer',
            sessionTimeout: 30000,
            heartbeatInterval: 3000,
            maxWaitTimeInMs: 5000,
            allowAutoTopicCreation: true,
          },
          producer: {
            maxInFlightRequests: 1,
            idempotent: true,
            transactionTimeout: 30000,
          },
        },
      },
    ]),
  ],
  providers: [KafkaService],
  exports: [KafkaService, ClientsModule],
})
export class KafkaModule {}
