import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReciboOcrService } from './recibo-ocr.service';

const MIME_TYPES_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB

@Controller('recibo-ocr')
export class ReciboOcrController {
  constructor(private readonly reciboOcrService: ReciboOcrService) {}

  @Post('extraer')
  @UseInterceptors(FileInterceptor('file'))
  async extraer(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se ha proporcionado ninguna imagen');
    }

    if (!MIME_TYPES_PERMITIDOS.includes(file.mimetype)) {
      throw new BadRequestException(
        'Tipo de archivo no permitido. Solo se aceptan fotos JPG, PNG o WEBP',
      );
    }

    if (file.size > TAMANO_MAXIMO_BYTES) {
      throw new BadRequestException(
        `La imagen supera el tamaño máximo permitido (${TAMANO_MAXIMO_BYTES / 1024 / 1024} MB)`,
      );
    }

    return this.reciboOcrService.extraerDeImagen(file);
  }
}
