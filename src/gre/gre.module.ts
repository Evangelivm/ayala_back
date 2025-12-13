import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

// Services
import { GreDetectorService } from './services/gre-detector.service';
import { GreProducerService } from './services/gre-producer.service';
import { GreConsumerService } from './services/gre-consumer.service';
import { GrePollingService } from './services/gre-polling.service';
import { GreTestService } from './services/gre-test.service';

// Controllers
import { GreController } from './gre.controller';
import { GreCrudController } from './gre-crud.controller';

// Modules
import { KafkaModule } from '../kafka/kafka.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    KafkaModule,
    PrismaModule,
    WebsocketModule,
    ScheduleModule.forRoot(), // Para los cron jobs del detector
  ],
  controllers: [
    GreController,
    GreCrudController, // CRUD endpoints para frontend
    GreConsumerService, // ✅ Como controller para @MessagePattern
  ],
  providers: [
    GreDetectorService,
    GreProducerService,
    GreConsumerService, // ✅ Como provider para inyección (NestJS optimiza, no duplica instancia)
    GrePollingService,
    GreTestService,
  ],
  exports: [
    GreDetectorService,
    GreProducerService,
    GrePollingService,
    GreTestService,
  ],
})
export class GreModule {}