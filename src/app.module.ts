import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { PersonalModule } from './personal/personal.module';
import { ProyectosModule } from './proyectos/proyectos.module';
import { MaquinariaModule } from './maquinaria/maquinaria.module';
import { ReportesModule } from './reportes/reportes.module';
import { EquiposModule } from './equipos/equipos.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    PrismaModule,
    PersonalModule,
    ProyectosModule,
    MaquinariaModule,
    ReportesModule,
    EquiposModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
