import { Module } from '@nestjs/common';
import { FrentesService } from './frentes.service';
import { FrentesController } from './frentes.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FrentesController],
  providers: [FrentesService],
})
export class FrentesModule {}