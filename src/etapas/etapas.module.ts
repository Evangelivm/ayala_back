import { Module } from '@nestjs/common';
import { EtapasService } from './etapas.service';
import { EtapasController } from './etapas.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EtapasController],
  providers: [EtapasService],
})
export class EtapasModule {}