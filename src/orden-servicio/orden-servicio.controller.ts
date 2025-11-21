import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Res,
  HttpCode,
  HttpStatus,
  Request,
  UsePipes,
} from '@nestjs/common';
import { Response } from 'express';
import { OrdenServicioService } from './orden-servicio.service';
import {
  CreateOrdenServicioDto,
  CreateOrdenServicioSchema,
} from './dto/create-orden-servicio.dto';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

@Controller('ordenes-servicio')
export class OrdenServicioController {
  constructor(private readonly ordenServicioService: OrdenServicioService) {}

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
  @UsePipes(new ZodValidationPipe(CreateOrdenServicioSchema))
  async create(
    @Body() createOrdenServicioDto: CreateOrdenServicioDto,
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
}
