import { Module } from '@nestjs/common';
import { CentroproyectoController } from './centroproyecto.controller';
import { CentroproyectoService } from './centroproyecto.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CentroproyectoController],
  providers: [CentroproyectoService],
  exports: [CentroproyectoService],
})
export class CentroproyectoModule {}
