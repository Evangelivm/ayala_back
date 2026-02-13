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
import { OrdenCompraService } from './orden-compra.service';
import {
  CreateOrdenCompraDto,
  CreateOrdenCompraSchema,
} from './dto/create-orden-compra.dto';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { DropboxService } from '../dropbox/dropbox.service';

@Controller('ordenes-compra')
export class OrdenCompraController {
  constructor(
    private readonly ordenCompraService: OrdenCompraService,
    private readonly dropboxService: DropboxService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll() {
    try {
      const ordenes = await this.ordenCompraService.findAll();
      return ordenes;
    } catch (error) {
      console.error('Error obteniendo órdenes de compra:', error);
      throw error;
    }
  }

  @Get('siguiente-numero')
  @HttpCode(HttpStatus.OK)
  async obtenerSiguienteNumero() {
    try {
      const resultado =
        await this.ordenCompraService.obtenerSiguienteNumeroOrden();
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
      const tipoCambio = await this.ordenCompraService.obtenerTipoCambioSunat();
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
    @Body(new ZodValidationPipe(CreateOrdenCompraSchema)) createOrdenCompraDto: CreateOrdenCompraDto,
    @Request() req: any,
  ) {
    try {
      // Obtener el usuario del request (asumiendo que está en req.user.id)
      // Si no tienes autenticación implementada, puedes usar un valor por defecto
      const usuarioId = req.user?.id || 1;

      const result = await this.ordenCompraService.create(
        createOrdenCompraDto,
        usuarioId,
      );

      return result;
    } catch (error) {
      console.error('Error creando orden de compra:', error);
      throw error;
    }
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateOrdenCompraSchema)) updateOrdenCompraDto: CreateOrdenCompraDto,
    @Request() req: any,
  ) {
    try {
      const usuarioId = req.user?.id || 1;

      const result = await this.ordenCompraService.update(
        +id,
        updateOrdenCompraDto,
        usuarioId,
      );

      return result;
    } catch (error) {
      console.error('Error actualizando orden de compra:', error);
      throw error;
    }
  }

  @Get('pdf/:id')
  async generatePdf(@Param('id') id: string, @Res() res: Response) {
    try {
      const mockData = await this.ordenCompraService.getMockData(id);
      const pdfBuffer = await this.ordenCompraService.generatePDF(mockData);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename=orden-compra-${id}.pdf`,
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generando PDF de orden de compra:', error);
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
      await this.ordenCompraService.remove(+id);
      return {
        success: true,
        message: 'Orden de compra eliminada exitosamente',
      };
    } catch (error) {
      console.error('Error eliminando orden de compra:', error);
      throw error;
    }
  }

  @Patch(':id/aprobar-contabilidad')
  @HttpCode(HttpStatus.OK)
  async aprobarContabilidad(@Param('id') id: string) {
    try {
      await this.ordenCompraService.aprobarContabilidad(+id);
      return {
        success: true,
        message: 'Orden de compra aprobada para contabilidad exitosamente',
      };
    } catch (error) {
      console.error('Error aprobando orden de compra para contabilidad:', error);
      throw error;
    }
  }

  @Patch(':id/aprobar-administrador')
  @HttpCode(HttpStatus.OK)
  async aprobarAdministrador(@Param('id') id: string) {
    try {
      await this.ordenCompraService.aprobarAdministrador(+id);
      return {
        success: true,
        message: 'Orden de compra aprobada para administración exitosamente',
      };
    } catch (error) {
      console.error('Error aprobando orden de compra para administración:', error);
      throw error;
    }
  }

  @Patch(':id/aprobar-jefe-proyecto')
  @HttpCode(HttpStatus.OK)
  async aprobarJefeProyecto(@Param('id') id: string) {
    try {
      await this.ordenCompraService.aprobarJefeProyecto(+id);
      return {
        success: true,
        message: 'Orden de compra aprobada por jefe de proyecto exitosamente',
      };
    } catch (error) {
      console.error('Error aprobando orden de compra para jefe de proyecto:', error);
      throw error;
    }
  }

  @Patch(':id/transferir')
  @HttpCode(HttpStatus.OK)
  async transferirOrden(@Param('id') id: string) {
    try {
      await this.ordenCompraService.transferirOrden(+id);
      return {
        success: true,
        message: 'Orden de compra transferida exitosamente',
      };
    } catch (error) {
      console.error('Error al transferir orden de compra:', error);
      throw error;
    }
  }

  @Patch(':id/pagar')
  @HttpCode(HttpStatus.OK)
  async pagarOrden(@Param('id') id: string) {
    try {
      await this.ordenCompraService.pagarOrden(+id);
      return {
        success: true,
        message: 'Orden de compra pagada exitosamente',
      };
    } catch (error) {
      console.error('Error al pagar orden de compra:', error);
      throw error;
    }
  }

  @Patch(':id/numero-factura')
  @HttpCode(HttpStatus.OK)
  async actualizarNumeroFactura(
    @Param('id') id: string,
    @Body() body: { nro_factura: string },
  ) {
    try {
      await this.ordenCompraService.actualizarNumeroFactura(+id, body.nro_factura);
      return {
        success: true,
        message: 'Número de factura actualizado exitosamente',
      };
    } catch (error) {
      console.error('Error al actualizar número de factura:', error);
      throw error;
    }
  }

  @Post('migrar-estados')
  @HttpCode(HttpStatus.OK)
  async migrarEstados() {
    try {
      const resultado = await this.ordenCompraService.migrarOrdenesACompletada();
      return {
        success: true,
        message: `Migración completada. ${resultado.actualizadas} órdenes actualizadas a COMPLETADA`,
        ...resultado,
      };
    } catch (error) {
      console.error('Error al migrar estados de órdenes de compra:', error);
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
      console.log(`📤 Iniciando subida de archivo para orden de compra ID: ${id}`);

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

      // Obtener datos de la orden de compra
      console.log(`🔍 Obteniendo datos de la orden de compra ID: ${id}`);
      const ordenData = await this.ordenCompraService.getOrdenData(+id);
      console.log(`✅ Orden encontrada: ${ordenData.numero_orden}`);

      // Subir archivo a Dropbox usando el número de orden y fecha de registro
      console.log(`☁️ Subiendo archivo a Dropbox...`);
      const result = await this.dropboxService.uploadOrdenFile(
        file.buffer,
        ordenData.numero_orden,
        ordenData.fecha_registro,
        'ordenes-compra',
        file.originalname,
      );

      uploadedFilePath = result.filePath;
      console.log(`✅ Archivo subido exitosamente a: ${result.filePath}`);

      // Guardar la URL del archivo en la base de datos
      console.log(`💾 Guardando URL en base de datos...`);
      try {
        await this.ordenCompraService.updateFileUrl(+id, result.fileUrl);
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
      console.error('❌ Error al subir archivo para orden de compra:', error);
      throw error;
    }
  }

  @Post(':id/upload-cotizacion')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadCotizacion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    let uploadedFilePath: string | null = null;

    try {
      console.log(`📤 Iniciando subida de cotización para orden de compra ID: ${id}`);

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

      // Obtener datos de la orden de compra
      console.log(`🔍 Obteniendo datos de la orden de compra ID: ${id}`);
      const ordenData = await this.ordenCompraService.getOrdenData(+id);
      console.log(`✅ Orden encontrada: ${ordenData.numero_orden}`);

      // Subir archivo a Dropbox usando el número de orden y fecha de registro con sufijo "-cotizacion"
      console.log(`☁️ Subiendo cotización a Dropbox...`);
      const result = await this.dropboxService.uploadOrdenFile(
        file.buffer,
        `${ordenData.numero_orden}-cotizacion`,
        ordenData.fecha_registro,
        'ordenes-compra',
        file.originalname,
      );

      uploadedFilePath = result.filePath;
      console.log(`✅ Cotización subida exitosamente a: ${result.filePath}`);

      // Guardar la URL de la cotización en la base de datos
      console.log(`💾 Guardando URL de cotización en base de datos...`);
      try {
        await this.ordenCompraService.updateCotizacionUrl(+id, result.fileUrl);
        console.log(`✅ URL de cotización guardada exitosamente en la base de datos`);
      } catch (dbError) {
        console.error('❌ Error al guardar URL de cotización en base de datos:', dbError);

        // ROLLBACK: Eliminar el archivo de Dropbox si falla guardar en BD
        console.log(`🔄 Iniciando rollback: eliminando cotización de Dropbox...`);
        try {
          await this.dropboxService.deleteFile(uploadedFilePath);
          console.log(`✅ Rollback completado: cotización eliminada de Dropbox`);
        } catch (rollbackError) {
          console.error('❌ Error durante rollback al eliminar cotización:', rollbackError);
          throw new BadRequestException(
            'Error crítico: La cotización se subió a Dropbox pero no se pudo guardar en la base de datos, ' +
            'y tampoco se pudo eliminar de Dropbox. Contacte al administrador. ' +
            'Ruta del archivo: ' + uploadedFilePath
          );
        }

        throw new BadRequestException(
          'La cotización se subió a Dropbox pero no se pudo guardar la URL en la base de datos. ' +
          'El archivo fue eliminado automáticamente. Por favor, intente nuevamente.'
        );
      }

      console.log(`🎉 Cotización procesada exitosamente`);

      return {
        ...result,
        message: `Cotización subida exitosamente como: ${result.fileName || 'archivo'}`,
      };
    } catch (error) {
      console.error('❌ Error al subir cotización para orden de compra:', error);
      throw error;
    }
  }

  @Post(':id/upload-factura')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFactura(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    let uploadedFilePath: string | null = null;

    try {
      console.log(`📤 Iniciando subida de factura para orden de compra ID: ${id}`);

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

      // Obtener datos de la orden de compra
      console.log(`🔍 Obteniendo datos de la orden de compra ID: ${id}`);
      const ordenData = await this.ordenCompraService.getOrdenData(+id);
      console.log(`✅ Orden encontrada: ${ordenData.numero_orden}`);

      // Subir archivo a Dropbox usando el número de orden y fecha de registro con sufijo "-factura"
      console.log(`☁️ Subiendo factura a Dropbox...`);
      const result = await this.dropboxService.uploadOrdenFile(
        file.buffer,
        `${ordenData.numero_orden}-factura`,
        ordenData.fecha_registro,
        'ordenes-compra',
        file.originalname,
      );

      uploadedFilePath = result.filePath;
      console.log(`✅ Factura subida exitosamente a: ${result.filePath}`);

      // Guardar la URL de la factura en la base de datos
      console.log(`💾 Guardando URL de factura en base de datos...`);
      try {
        await this.ordenCompraService.updateFacturaUrl(+id, result.fileUrl);
        console.log(`✅ URL de factura guardada exitosamente en la base de datos`);
      } catch (dbError) {
        console.error('❌ Error al guardar URL de factura en base de datos:', dbError);

        // ROLLBACK: Eliminar el archivo de Dropbox si falla guardar en BD
        console.log(`🔄 Iniciando rollback: eliminando factura de Dropbox...`);
        try {
          await this.dropboxService.deleteFile(uploadedFilePath);
          console.log(`✅ Rollback completado: factura eliminada de Dropbox`);
        } catch (rollbackError) {
          console.error('❌ Error durante rollback al eliminar factura:', rollbackError);
          throw new BadRequestException(
            'Error crítico: La factura se subió a Dropbox pero no se pudo guardar en la base de datos, ' +
            'y tampoco se pudo eliminar de Dropbox. Contacte al administrador. ' +
            'Ruta del archivo: ' + uploadedFilePath
          );
        }

        throw new BadRequestException(
          'La factura se subió a Dropbox pero no se pudo guardar la URL en la base de datos. ' +
          'El archivo fue eliminado automáticamente. Por favor, intente nuevamente.'
        );
      }

      console.log(`🎉 Factura procesada exitosamente`);

      return {
        ...result,
        message: `Factura subida exitosamente como: ${result.fileName || 'archivo'}`,
      };
    } catch (error) {
      console.error('❌ Error al subir factura para orden de compra:', error);
      throw error;
    }
  }

  @Post(':id/upload-comprobante-retencion')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadComprobanteRetencion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('nro_serie') nroSerie: string,
  ) {
    let uploadedFilePath: string | null = null;

    try {
      console.log(`📤 Iniciando subida de comprobante de retención para orden de compra ID: ${id}`);

      // Validar que se haya subido un archivo
      if (!file) {
        throw new BadRequestException('No se ha proporcionado ningún archivo');
      }

      // Validar que se haya proporcionado el número de serie
      if (!nroSerie || nroSerie.trim() === '') {
        throw new BadRequestException('El número de serie es requerido');
      }

      // Validar tipo de archivo (PDF e imágenes)
      const allowedMimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          'Tipo de archivo no permitido. Solo se aceptan PDF e imágenes (JPG, PNG)',
        );
      }

      console.log(`📋 Archivo recibido: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`🔢 Número de serie: ${nroSerie}`);

      // Validar tamaño máximo (30 MB)
      const maxSize = 30 * 1024 * 1024;
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);

      if (file.size > maxSize) {
        console.error(`❌ Archivo demasiado grande: ${fileSizeMB} MB (máximo: 30 MB)`);
        throw new BadRequestException(
          `El archivo es demasiado grande. Tamaño actual: ${fileSizeMB} MB. Tamaño máximo permitido: 30 MB. ` +
          `Por favor, comprime el archivo antes de subirlo.`,
        );
      }

      console.log(`✅ Tamaño del archivo validado: ${fileSizeMB} MB / 30 MB`);

      // Obtener datos de la orden de compra
      console.log(`🔍 Obteniendo datos de la orden de compra ID: ${id}`);
      const ordenData = await this.ordenCompraService.getOrdenData(+id);
      console.log(`✅ Orden encontrada: ${ordenData.numero_orden}`);

      // Subir archivo a Dropbox usando el número de orden y fecha de registro con sufijo "-comprobante-retencion"
      console.log(`☁️ Subiendo comprobante de retención a Dropbox...`);
      const result = await this.dropboxService.uploadOrdenFile(
        file.buffer,
        `${ordenData.numero_orden}-comprobante-retencion`,
        ordenData.fecha_registro,
        'ordenes-compra',
        file.originalname,
      );

      uploadedFilePath = result.filePath;
      console.log(`✅ Comprobante de retención subido exitosamente a: ${result.filePath}`);

      // Guardar la URL del comprobante y el número de serie en la base de datos
      console.log(`💾 Guardando URL de comprobante de retención y número de serie en base de datos...`);
      try {
        await this.ordenCompraService.updateComprobanteRetencionUrl(+id, result.fileUrl, nroSerie.trim());
        console.log(`✅ URL de comprobante de retención y número de serie guardados exitosamente en la base de datos`);
      } catch (dbError) {
        console.error('❌ Error al guardar URL de comprobante de retención en base de datos:', dbError);

        // ROLLBACK: Eliminar el archivo de Dropbox si falla guardar en BD
        console.log(`🔄 Iniciando rollback: eliminando comprobante de retención de Dropbox...`);
        try {
          await this.dropboxService.deleteFile(uploadedFilePath);
          console.log(`✅ Rollback completado: comprobante de retención eliminado de Dropbox`);
        } catch (rollbackError) {
          console.error('❌ Error durante rollback al eliminar comprobante de retención:', rollbackError);
          throw new BadRequestException(
            'Error crítico: El comprobante de retención se subió a Dropbox pero no se pudo guardar en la base de datos, ' +
            'y tampoco se pudo eliminar de Dropbox. Contacte al administrador. ' +
            'Ruta del archivo: ' + uploadedFilePath
          );
        }

        throw new BadRequestException(
          'El comprobante de retención se subió a Dropbox pero no se pudo guardar la URL en la base de datos. ' +
          'El archivo fue eliminado automáticamente. Por favor, intente nuevamente.'
        );
      }

      console.log(`🎉 Comprobante de retención procesado exitosamente`);

      return {
        ...result,
        message: `Comprobante de retención subido exitosamente como: ${result.fileName || 'archivo'}`,
      };
    } catch (error) {
      console.error('❌ Error al subir comprobante de retención para orden de compra:', error);
      throw error;
    }
  }

  // ─── MULTIFACTURAS ────────────────────────────────────────────────────────

  @Get(':id/multifacturas')
  @HttpCode(HttpStatus.OK)
  async getMultifacturas(@Param('id') id: string) {
    return this.ordenCompraService.getMultifacturas(+id);
  }

  @Post(':id/multifacturas')
  @HttpCode(HttpStatus.OK)
  async saveMultifacturas(
    @Param('id') id: string,
    @Body() body: { rows: { id_detalle?: number; nro_serie?: string; nro_factura?: string; galones?: string; proyecto?: string }[] },
  ) {
    return this.ordenCompraService.saveMultifacturas(+id, body.rows || []);
  }

  @Post(':id/multifacturas/:detalleId/upload-factura')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMultifacturaFactura(
    @Param('id') id: string,
    @Param('detalleId') detalleId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No se ha proporcionado ningún archivo');

    // Eliminar archivo anterior si existe
    const detalle = await this.ordenCompraService.getMultifacturaDetalle(+detalleId);
    if (detalle?.url_factura) {
      await this.dropboxService.deleteFileBySharedUrl(detalle.url_factura);
    }

    const orden = await this.ordenCompraService.getOrdenData(+id);
    const nombreArchivo = `factura-${orden.numero_orden}-det${detalleId}`;
    const result = await this.dropboxService.uploadOrdenFile(
      file.buffer,
      nombreArchivo,
      new Date(orden.fecha_registro),
      'ordenes-compra',
      file.originalname,
    );

    await this.ordenCompraService.updateMultifacturaFileUrl(+detalleId, 'factura', result.fileUrl);
    return { message: 'Factura subida exitosamente', fileUrl: result.fileUrl };
  }

  @Post(':id/multifacturas/:detalleId/upload-guia')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMultifacturaGuia(
    @Param('id') id: string,
    @Param('detalleId') detalleId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No se ha proporcionado ningún archivo');

    // Eliminar archivo anterior si existe
    const detalle = await this.ordenCompraService.getMultifacturaDetalle(+detalleId);
    if (detalle?.url_guia) {
      await this.dropboxService.deleteFileBySharedUrl(detalle.url_guia);
    }

    const orden = await this.ordenCompraService.getOrdenData(+id);
    const nombreArchivo = `guia-${orden.numero_orden}-det${detalleId}`;
    const result = await this.dropboxService.uploadOrdenFile(
      file.buffer,
      nombreArchivo,
      new Date(orden.fecha_registro),
      'ordenes-compra',
      file.originalname,
    );

    await this.ordenCompraService.updateMultifacturaFileUrl(+detalleId, 'guia', result.fileUrl);
    return { message: 'Guía subida exitosamente', fileUrl: result.fileUrl };
  }
}
