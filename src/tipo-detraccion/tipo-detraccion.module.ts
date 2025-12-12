import { Module } from '@nestjs/common';
import { TipoDetraccionController } from './tipo-detraccion.controller';
import { TipoDetraccionService } from './tipo-detraccion.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TipoDetraccionController],
  providers: [TipoDetraccionService],
  exports: [TipoDetraccionService],
})
export class TipoDetraccionModule {}
