import { Module } from '@nestjs/common';
import { OrdenServicioController } from './orden-servicio.controller';
import { OrdenServicioService } from './orden-servicio.service';
import { DropboxModule } from '../dropbox/dropbox.module';

@Module({
  imports: [DropboxModule],
  controllers: [OrdenServicioController],
  providers: [OrdenServicioService],
  exports: [OrdenServicioService],
})
export class OrdenServicioModule {}
