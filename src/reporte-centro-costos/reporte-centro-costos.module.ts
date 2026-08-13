import { Module } from '@nestjs/common';
import { ReporteCentroCostosController } from './reporte-centro-costos.controller';
import { ReporteCentroCostosService } from './reporte-centro-costos.service';

@Module({
  controllers: [ReporteCentroCostosController],
  providers: [ReporteCentroCostosService],
})
export class ReporteCentroCostosModule {}
