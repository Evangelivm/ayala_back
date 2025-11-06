import { Module } from '@nestjs/common';
import { AcarreoService } from './acarreo.service';
import { AcarreoController } from './acarreo.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AcarreoController],
  providers: [AcarreoService],
  exports: [AcarreoService],
})
export class AcarreoModule {}
