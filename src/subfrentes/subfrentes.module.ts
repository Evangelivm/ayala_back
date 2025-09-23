import { Module } from '@nestjs/common';
import { SubfrentesService } from './subfrentes.service';
import { SubfrentesController } from './subfrentes.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SubfrentesController],
  providers: [SubfrentesService, PrismaService],
  exports: [SubfrentesService],
})
export class SubfrentesModule {}