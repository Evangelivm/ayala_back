import { Module } from '@nestjs/common';
import { OpcionesProgramacionController } from './opciones-programacion.controller';
import { OpcionesProgramacionService } from './opciones-programacion.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OpcionesProgramacionController],
  providers: [OpcionesProgramacionService],
})
export class OpcionesProgramacionModule {}
