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
import { ProgramacionModule } from './programacion/programacion.module';
import { EtapasModule } from './etapas/etapas.module';
import { SectoresModule } from './sectores/sectores.module';
import { FrentesModule } from './frentes/frentes.module';
import { PartidasModule } from './partidas/partidas.module';

@Module({
  imports: [
    PrismaModule,
    PersonalModule,
    ProyectosModule,
    MaquinariaModule,
    ReportesModule,
    EquiposModule,
    DashboardModule,
    ProgramacionModule,
    EtapasModule,
    SectoresModule,
    FrentesModule,
    PartidasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
