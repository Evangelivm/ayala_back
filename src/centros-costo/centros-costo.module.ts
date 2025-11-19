import { Module } from '@nestjs/common';
import { CentrosCostoController } from './centros-costo.controller';
import { CentrosCostoService } from './centros-costo.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CentrosCostoController],
  providers: [CentrosCostoService],
  exports: [CentrosCostoService],
})
export class CentrosCostoModule {}
