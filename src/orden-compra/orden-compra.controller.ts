import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Res,
  HttpCode,
  HttpStatus,
  Request,
  UsePipes,
} from '@nestjs/common';
import { Response } from 'express';
import { OrdenCompraService } from './orden-compra.service';
import {
  CreateOrdenCompraDto,
  CreateOrdenCompraSchema,
} from './dto/create-orden-compra.dto';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

@Controller('ordenes-compra')
export class OrdenCompraController {
  constructor(private readonly ordenCompraService: OrdenCompraService) {}

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
  @UsePipes(new ZodValidationPipe(CreateOrdenCompraSchema))
  async create(
    @Body() createOrdenCompraDto: CreateOrdenCompraDto,
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
}
