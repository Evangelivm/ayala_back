import { Module } from '@nestjs/common';
import { RegistroComprasService } from './registro-compras.service';
import { RegistroComprasController } from './registro-compras.controller';

@Module({
  controllers: [RegistroComprasController],
  providers: [RegistroComprasService],
  exports: [RegistroComprasService],
})
export class RegistroComprasModule {}
