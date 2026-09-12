import { Module } from '@nestjs/common';
import { ReciboOcrController } from './recibo-ocr.controller';
import { ReciboOcrService } from './recibo-ocr.service';

@Module({
  controllers: [ReciboOcrController],
  providers: [ReciboOcrService],
  exports: [ReciboOcrService],
})
export class ReciboOcrModule {}
