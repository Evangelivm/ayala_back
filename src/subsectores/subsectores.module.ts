import { Module } from '@nestjs/common';
import { SubsectoresService } from './subsectores.service';
import { SubsectoresController } from './subsectores.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SubsectoresController],
  providers: [SubsectoresService, PrismaService],
  exports: [SubsectoresService],
})
export class SubsectoresModule {}