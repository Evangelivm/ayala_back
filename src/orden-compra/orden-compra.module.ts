import { Module } from '@nestjs/common';
import { OrdenCompraController } from './orden-compra.controller';
import { OrdenCompraService } from './orden-compra.service';
import { DropboxModule } from '../dropbox/dropbox.module';

@Module({
  imports: [DropboxModule],
  controllers: [OrdenCompraController],
  providers: [OrdenCompraService],
  exports: [OrdenCompraService],
})
export class OrdenCompraModule {}
