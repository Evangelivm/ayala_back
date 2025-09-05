import { Module } from '@nestjs/common';
import { ProgramacionService } from './programacion.service';
import { ProgramacionController } from './programacion.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProgramacionController],
  providers: [ProgramacionService],
  exports: [ProgramacionService],
})
export class ProgramacionModule {}