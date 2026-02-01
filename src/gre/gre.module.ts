import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

// Services - GRE Regular
import { GreDetectorService } from './services/gre-detector.service';
import { GreProducerService } from './services/gre-producer.service';
import { GreConsumerService } from './services/gre-consumer.service';
import { GrePollingService } from './services/gre-polling.service';
import { GreTestService } from './services/gre-test.service';

// Services - GRE Extendido (para programación extendida)
import { GreExtendidoDetectorService } from './services/gre-extendido-detector.service';
import { GreExtendidoProducerService } from './services/gre-extendido-producer.service';
import { GreExtendidoConsumerService } from './services/gre-extendido-consumer.service';
import { GreExtendidoPollingService } from './services/gre-extendido-polling.service';

// Controllers
import { GreController } from './gre.controller';
import { GreCrudController } from './gre-crud.controller';
import { GreExtendidoCrudController } from './gre-extendido-crud.controller';

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
    GreExtendidoCrudController, // CRUD endpoints para frontend - TTT2
    GreConsumerService, // ✅ Como controller para @MessagePattern
    GreExtendidoConsumerService, // ✅ Como controller para @MessagePattern extendido
  ],
  providers: [
    // GRE Regular
    GreDetectorService,
    GreProducerService,
    GreConsumerService, // ✅ Como provider para inyección (NestJS optimiza, no duplica instancia)
    GrePollingService,
    GreTestService,
    // GRE Extendido
    GreExtendidoDetectorService,
    GreExtendidoProducerService,
    GreExtendidoConsumerService, // ✅ Como provider para inyección
    GreExtendidoPollingService,
  ],
  exports: [
    // GRE Regular
    GreDetectorService,
    GreProducerService,
    GrePollingService,
    GreTestService,
    // GRE Extendido
    GreExtendidoDetectorService,
    GreExtendidoProducerService,
    GreExtendidoPollingService,
  ],
})
export class GreModule {}