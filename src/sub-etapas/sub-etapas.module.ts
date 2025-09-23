import { Module } from '@nestjs/common';
import { SubEtapasService } from './sub-etapas.service';
import { SubEtapasController } from './sub-etapas.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SubEtapasController],
  providers: [SubEtapasService, PrismaService],
  exports: [SubEtapasService],
})
export class SubEtapasModule {}