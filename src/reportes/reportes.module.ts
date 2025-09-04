import { Module } from '@nestjs/common';
import { ViajesEliminacionController } from '../controllers/viajes-eliminacion.controller';
import { ReportesOperadoresController } from '../controllers/reportes-operadores.controller';
import { ReportesPlantillerosController } from '../controllers/reportes-plantilleros.controller';
import { InformeConsumoCombustibleController } from '../controllers/informe-consumo-combustible.controller';
import { ViajesEliminacionService } from '../services/viajes-eliminacion.service';
import { ReportesOperadoresService } from '../services/reportes-operadores.service';
import { ReportesPlantillerosService } from '../services/reportes-plantilleros.service';
import { InformeConsumoCombustibleService } from '../services/informe-consumo-combustible.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    ViajesEliminacionController,
    ReportesOperadoresController,
    ReportesPlantillerosController,
    InformeConsumoCombustibleController,
  ],
  providers: [
    ViajesEliminacionService,
    ReportesOperadoresService,
    ReportesPlantillerosService,
    InformeConsumoCombustibleService,
  ],
  exports: [
    ViajesEliminacionService,
    ReportesOperadoresService,
    ReportesPlantillerosService,
    InformeConsumoCombustibleService,
  ],
})
export class ReportesModule {}