import { Module } from '@nestjs/common';
import { OrdenServicioController } from './orden-servicio.controller';
import { OrdenServicioService } from './orden-servicio.service';
import { DropboxModule } from '../dropbox/dropbox.module';
import { NumeracionOrdenModule } from '../numeracion-orden/numeracion-orden.module';

@Module({
  imports: [DropboxModule, NumeracionOrdenModule],
  controllers: [OrdenServicioController],
  providers: [OrdenServicioService],
  exports: [OrdenServicioService],
})
export class OrdenServicioModule {}
