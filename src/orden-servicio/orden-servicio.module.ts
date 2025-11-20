import { Module } from '@nestjs/common';
import { OrdenServicioController } from './orden-servicio.controller';
import { OrdenServicioService } from './orden-servicio.service';

@Module({
  controllers: [OrdenServicioController],
  providers: [OrdenServicioService],
  exports: [OrdenServicioService],
})
export class OrdenServicioModule {}
