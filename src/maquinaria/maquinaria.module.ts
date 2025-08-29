import { Module } from '@nestjs/common';
import { MaquinariaService } from './maquinaria.service';
import { MaquinariaController } from './maquinaria.controller';

@Module({
  controllers: [MaquinariaController],
  providers: [MaquinariaService],
  exports: [MaquinariaService],
})
export class MaquinariaModule {}