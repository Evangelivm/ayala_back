import { Module } from '@nestjs/common';
import { SubpartidasService } from './subpartidas.service';
import { SubpartidasController } from './subpartidas.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SubpartidasController],
  providers: [SubpartidasService, PrismaService],
  exports: [SubpartidasService],
})
export class SubpartidasModule {}