import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Res,
  HttpCode,
  HttpStatus,
  Request,
  UsePipes,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { OrdenServicioService } from './orden-servicio.service';
import {
  CreateOrdenServicioDto,
  CreateOrdenServicioSchema,
} from './dto/create-orden-servicio.dto';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { DropboxService } from '../dropbox/dropbox.service';

@Controller('ordenes-servicio')
export class OrdenServicioController {
  constructor(
    private readonly ordenServicioService: OrdenServicioService,
    private readonly dropboxService: DropboxService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll() {
    try {
      const ordenes = await this.ordenServicioService.findAll();
      return ordenes;
    } catch (error) {
      console.error('Error obteniendo órdenes de servicio:', error);
      throw error;
    }
  }

  @Get('siguiente-numero')
  @HttpCode(HttpStatus.OK)
  async obtenerSiguienteNumero() {
    try {
      const resultado =
        await this.ordenServicioService.obtenerSiguienteNumeroOrden();
      return resultado;
    } catch (error) {
      console.error('Error obteniendo siguiente número de orden:', error);
      throw error;
    }
  }

  @Get('tipo-cambio')
  @HttpCode(HttpStatus.OK)
  async obtenerTipoCambio() {
    try {
      const tipoCambio = await this.ordenServicioService.obtenerTipoCambioSunat();
      return {
        success: true,
        tipo_cambio: tipoCambio,
        fecha: new Date().toISOString().split('T')[0],
      };
    } catch (error) {
      console.error('Error obteniendo tipo de cambio:', error);
      throw error;
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(CreateOrdenServicioSchema)) createOrdenServicioDto: CreateOrdenServicioDto,
    @Request() req: any,
  ) {
    try {
      // Obtener el usuario del request (asumiendo que está en req.user.id)
      // Si no tienes autenticación implementada, puedes usar un valor por defecto
      const usuarioId = req.user?.id || 1;

      const result = await this.ordenServicioService.create(
        createOrdenServicioDto,
        usuarioId,
      );

      return result;
    } catch (error) {
      console.error('Error creando orden de servicio:', error);
      throw error;
    }
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateOrdenServicioSchema)) updateOrdenServicioDto: CreateOrdenServicioDto,
    @Request() req: any,
  ) {
    try {
      const usuarioId = req.user?.id || 1;

      const result = await this.ordenServicioService.update(
        +id,
        updateOrdenServicioDto,
        usuarioId,
      );

      return result;
    } catch (error) {
      console.error('Error actualizando orden de servicio:', error);
      throw error;
    }
  }

  @Get('pdf/:id')
  async generatePdf(@Param('id') id: string, @Res() res: Response) {
    try {
      const mockData = await this.ordenServicioService.getMockData(id);
      const pdfBuffer = await this.ordenServicioService.generatePDF(mockData);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename=orden-servicio-${id}.pdf`,
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generando PDF de orden de servicio:', error);
      res.status(500).json({
        message: 'Error generando PDF',
        error: error.message,
      });
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    try {
      await this.ordenServicioService.remove(+id);
      return {
        success: true,
        message: 'Orden de servicio eliminada exitosamente',
      };
    } catch (error) {
      console.error('Error eliminando orden de servicio:', error);
      throw error;
    }
  }

  @Patch(':id/aprobar-contabilidad')
  @HttpCode(HttpStatus.OK)
  async aprobarContabilidad(@Param('id') id: string) {
    try {
      await this.ordenServicioService.aprobarContabilidad(+id);
      return {
        success: true,
        message: 'Orden de servicio aprobada para contabilidad exitosamente',
      };
    } catch (error) {
      console.error('Error aprobando orden de servicio para contabilidad:', error);
      throw error;
    }
  }

  @Patch(':id/aprobar-administrador')
  @HttpCode(HttpStatus.OK)
  async aprobarAdministrador(@Param('id') id: string) {
    try {
      await this.ordenServicioService.aprobarAdministrador(+id);
      return {
        success: true,
        message: 'Orden de servicio aprobada para administración exitosamente',
      };
    } catch (error) {
      console.error('Error aprobando orden de servicio para administración:', error);
      throw error;
    }
  }

  @Patch(':id/transferir')
  @HttpCode(HttpStatus.OK)
  async transferirOrden(@Param('id') id: string) {
    try {
      await this.ordenServicioService.transferirOrden(+id);
      return {
        success: true,
        message: 'Orden de servicio transferida exitosamente',
      };
    } catch (error) {
      console.error('Error al transferir orden de servicio:', error);
      throw error;
    }
  }

  @Patch(':id/pagar')
  @HttpCode(HttpStatus.OK)
  async pagarOrden(@Param('id') id: string) {
    try {
      await this.ordenServicioService.pagarOrden(+id);
      return {
        success: true,
        message: 'Orden de servicio pagada exitosamente',
      };
    } catch (error) {
      console.error('Error al pagar orden de servicio:', error);
      throw error;
    }
  }

  @Post(':id/upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    let uploadedFilePath: string | null = null;

    try {
      console.log(`📤 Iniciando subida de archivo para orden de servicio ID: ${id}`);

      // Validar que se haya subido un archivo
      if (!file) {
        throw new BadRequestException('No se ha proporcionado ningún archivo');
      }

      // Validar tipo de archivo (PDF)
      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/jpg',
        'image/png',
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          'Tipo de archivo no permitido. Solo se aceptan PDF, Word, Excel e imágenes',
        );
      }

      console.log(`📋 Archivo recibido: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

      // Validar tamaño máximo (30 MB) ANTES de cualquier procesamiento
      const maxSize = 30 * 1024 * 1024; // 30 MB en bytes
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);

      if (file.size > maxSize) {
        console.error(`❌ Archivo demasiado grande: ${fileSizeMB} MB (máximo: 30 MB)`);
        throw new BadRequestException(
          `El archivo es demasiado grande. Tamaño actual: ${fileSizeMB} MB. Tamaño máximo permitido: 30 MB. ` +
          `Por favor, comprime el archivo antes de subirlo.`,
        );
      }

      console.log(`✅ Tamaño del archivo validado: ${fileSizeMB} MB / 30 MB`);

      // Obtener datos de la orden de servicio
      console.log(`🔍 Obteniendo datos de la orden de servicio ID: ${id}`);
      const ordenData = await this.ordenServicioService.getOrdenData(+id);
      console.log(`✅ Orden encontrada: ${ordenData.numero_orden}`);

      // Subir archivo a Dropbox usando el número de orden y fecha de registro
      console.log(`☁️ Subiendo archivo a Dropbox...`);
      const result = await this.dropboxService.uploadOrdenFile(
        file.buffer,
        ordenData.numero_orden,
        ordenData.fecha_registro,
        'ordenes-servicio',
        file.originalname,
      );

      uploadedFilePath = result.filePath;
      console.log(`✅ Archivo subido exitosamente a: ${result.filePath}`);

      // Guardar la URL del archivo en la base de datos
      console.log(`💾 Guardando URL en base de datos...`);
      try {
        await this.ordenServicioService.updateFileUrl(+id, result.fileUrl);
        console.log(`✅ URL guardada exitosamente en la base de datos`);
      } catch (dbError) {
        console.error('❌ Error al guardar URL en base de datos:', dbError);

        // ROLLBACK: Eliminar el archivo de Dropbox si falla guardar en BD
        console.log(`🔄 Iniciando rollback: eliminando archivo de Dropbox...`);
        try {
          await this.dropboxService.deleteFile(uploadedFilePath);
          console.log(`✅ Rollback completado: archivo eliminado de Dropbox`);
        } catch (rollbackError) {
          console.error('❌ Error durante rollback al eliminar archivo:', rollbackError);
          throw new BadRequestException(
            'Error crítico: El archivo se subió a Dropbox pero no se pudo guardar en la base de datos, ' +
            'y tampoco se pudo eliminar de Dropbox. Contacte al administrador. ' +
            'Ruta del archivo: ' + uploadedFilePath
          );
        }

        throw new BadRequestException(
          'El archivo se subió a Dropbox pero no se pudo guardar la URL en la base de datos. ' +
          'El archivo fue eliminado automáticamente. Por favor, intente nuevamente.'
        );
      }

      console.log(`🎉 Proceso completado exitosamente`);

      return {
        ...result,
        message: `Archivo subido exitosamente como: ${result.fileName || 'archivo'}`,
      };
    } catch (error) {
      console.error('❌ Error al subir archivo para orden de servicio:', error);
      throw error;
    }
  }
}
