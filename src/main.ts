import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { NestAppLogger } from './common/logger/nest-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new NestAppLogger(),
  });

  // Configurar CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Access-Control-Allow-Origin',
    ],
    maxAge: 86400,
    // credentials: true,
  });

  // Configurar prefijo global
  app.setGlobalPrefix('api');

  // ✅ Conectar microservicio Kafka para consumers con @MessagePattern
  app.connectMicroservice<MicroserviceOptions>({
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
        groupId: 'ayala-gre-consumer-group',
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        maxWaitTimeInMs: 5000,
        allowAutoTopicCreation: true,
      },
      subscribe: {
        fromBeginning: true, // ✅ Leer mensajes desde el inicio (importante para testing)
      },
    },
  });

  // ✅ Iniciar todos los microservicios conectados
  await app.startAllMicroservices();
  console.log('📡 Kafka Microservice consumers iniciados');

  const port = process.env.PORT || 3001;
  console.log(`🚀 Servidor HTTP corriendo en puerto ${port}`);
  await app.listen(port);
}
bootstrap();
