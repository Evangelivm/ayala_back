import { Module } from '@nestjs/common';
import { NumeracionOrdenController } from './numeracion-orden.controller';
import { NumeracionOrdenService } from './numeracion-orden.service';

@Module({
  controllers: [NumeracionOrdenController],
  providers: [NumeracionOrdenService],
  exports: [NumeracionOrdenService],
})
export class NumeracionOrdenModule {}
