import { Module } from '@nestjs/common';
import { KardexPdfController } from './kardex-pdf.controller';
import { KardexPdfService } from './kardex-pdf.service';

@Module({
  controllers: [KardexPdfController],
  providers: [KardexPdfService],
  exports: [KardexPdfService],
})
export class KardexPdfModule {}
