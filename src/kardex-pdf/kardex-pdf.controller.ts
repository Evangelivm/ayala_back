import { Controller, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { KardexPdfService } from './kardex-pdf.service';

@Controller('kardex-pdf')
export class KardexPdfController {
  constructor(private readonly kardexPdfService: KardexPdfService) {}

  @Post('generate')
  async generatePDF(@Body() kardexData: any, @Res() res: Response) {
    try {
      const pdfBuffer = await this.kardexPdfService.generatePDF(kardexData);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Kardex_LAR_${new Date().toISOString().split('T')[0]}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Error generating PDF',
        details: error.message,
      });
    }
  }
}
