import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

// Services
import { FacturaDetectorService } from './services/factura-detector.service';
import { FacturaProducerService } from './services/factura-producer.service';
import { FacturaConsumerService } from './services/factura-consumer.service';
import { FacturaPollingService } from './services/factura-polling.service';
import { FacturaTestService } from './services/factura-test.service';

// Controllers
import { FacturaController } from './controllers/factura.controller';
import { FacturaCrudController } from './controllers/factura-crud.controller';

// Modules
import { KafkaModule } from '../kafka/kafka.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    KafkaModule,
    PrismaModule,
    ScheduleModule.forRoot(), // Para los cron jobs del detector
  ],
  controllers: [
    FacturaController,
    FacturaCrudController, // CRUD endpoints para frontend
    FacturaConsumerService, // ✅ Como controller para @MessagePattern
  ],
  providers: [
    FacturaDetectorService,
    FacturaProducerService,
    FacturaConsumerService, // ✅ Como provider para inyección
    FacturaPollingService,
    FacturaTestService,
  ],
  exports: [
    FacturaDetectorService,
    FacturaProducerService,
    FacturaPollingService,
    FacturaTestService,
  ],
})
export class FacturaModule {}
