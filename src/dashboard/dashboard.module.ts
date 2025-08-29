import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportesModule } from '../reportes/reportes.module';
import { PersonalModule } from '../personal/personal.module';
import { ProyectosModule } from '../proyectos/proyectos.module';
import { EquiposModule } from '../equipos/equipos.module';

@Module({
  imports: [
    PrismaModule, 
    ReportesModule, 
    PersonalModule, 
    ProyectosModule, 
    EquiposModule
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}