import { Module } from '@nestjs/common';
import { FasecontrolController } from './fasecontrol.controller';
import { FasecontrolService } from './fasecontrol.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FasecontrolController],
  providers: [FasecontrolService],
  exports: [FasecontrolService],
})
export class FasecontrolModule {}
