import { Module } from '@nestjs/common';
import { ViajesEliminacionController } from '../controllers/viajes-eliminacion.controller';
import { ReportesOperadoresController } from '../controllers/reportes-operadores.controller';
import { ReportesPlantillerosController } from '../controllers/reportes-plantilleros.controller';
import { ViajesEliminacionService } from '../services/viajes-eliminacion.service';
import { ReportesOperadoresService } from '../services/reportes-operadores.service';
import { ReportesPlantillerosService } from '../services/reportes-plantilleros.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    ViajesEliminacionController,
    ReportesOperadoresController,
    ReportesPlantillerosController,
  ],
  providers: [
    ViajesEliminacionService,
    ReportesOperadoresService,
    ReportesPlantillerosService,
  ],
  exports: [
    ViajesEliminacionService,
    ReportesOperadoresService,
    ReportesPlantillerosService,
  ],
})
export class ReportesModule {}