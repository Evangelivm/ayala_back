import { Module } from '@nestjs/common';
import { CamionesController } from './camiones.controller';
import { CamionesService } from './camiones.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CamionesController],
  providers: [CamionesService],
  exports: [CamionesService],
})
export class CamionesModule {}
