import { Module, forwardRef } from '@nestjs/common';
import { ProgramacionService } from './programacion.service';
import { ProgramacionController } from './programacion.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GreModule } from '../gre/gre.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => GreModule), // Importar módulo GRE para acceder al producer
  ],
  controllers: [ProgramacionController],
  providers: [ProgramacionService],
  exports: [ProgramacionService],
})
export class ProgramacionModule {}