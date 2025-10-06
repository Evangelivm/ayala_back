import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { SubproyectosModule } from './subproyectos/subproyectos.module';
import { SubEtapasModule } from './sub-etapas/sub-etapas.module';
import { SubsectoresModule } from './subsectores/subsectores.module';
import { SubfrentesModule } from './subfrentes/subfrentes.module';
import { SubpartidasModule } from './subpartidas/subpartidas.module';
import { GreModule } from './gre/gre.module';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
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
    SubproyectosModule,
    SubEtapasModule,
    SubsectoresModule,
    SubfrentesModule,
    SubpartidasModule,
    KafkaModule,
    GreModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
