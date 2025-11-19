import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaThirdService } from './prisma-third.service';

@Global()
@Module({
  providers: [PrismaService, PrismaThirdService],
  exports: [PrismaService, PrismaThirdService],
})
export class PrismaModule {}