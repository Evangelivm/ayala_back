import { Module } from '@nestjs/common';
import { SubproyectosService } from './subproyectos.service';
import { SubproyectosController } from './subproyectos.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SubproyectosController],
  providers: [SubproyectosService, PrismaService],
  exports: [SubproyectosService],
})
export class SubproyectosModule {}