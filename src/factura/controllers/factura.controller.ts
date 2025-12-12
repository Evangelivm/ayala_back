import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FacturaTestService } from '../services/factura-test.service';
import { FacturaDetectorService } from '../services/factura-detector.service';
import { FacturaPollingService } from '../services/factura-polling.service';
import { FacturaConsumerService } from '../services/factura-consumer.service';
import { PrismaThirdService } from '../../prisma/prisma-third.service';

@Controller('factura')
export class FacturaController {
  private readonly logger = new Logger(FacturaController.name);

  constructor(
    private readonly testService: FacturaTestService,
    private readonly detectorService: FacturaDetectorService,
    private readonly pollingService: FacturaPollingService,
    private readonly consumerService: FacturaConsumerService,
    private readonly prisma: PrismaThirdService,
  ) {}

  /**
   * GET /factura/health
   * Verifica el estado del servicio de facturas
   */
  @Get('health')
  async getHealth() {
    return {
      status: 'healthy',
      detector: 'running',
      consumer: 'running',
      polling: {
        active: this.pollingService.getPollingStats().activePollings,
        healthy: true,
      },
    };
  }

  /**
   * GET /factura/status
   * Obtiene el estado general del sistema de facturas
   */
  @Get('status')
  async getStatus() {
    try {
      const consumerStats = await this.consumerService.getConsumerStats();
      const pollingStats = this.pollingService.getPollingStats();
      const detectorStats = await this.detectorService.getDetectionStats();

      return {
        timestamp: new Date().toISOString(),
        consumer: consumerStats,
        polling: pollingStats,
        detector: detectorStats,
        health: 'healthy',
      };
    } catch (error) {
      this.logger.error('Error obteniendo estado del sistema:', error);
      throw new HttpException(
        'Error obteniendo estado del sistema',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /factura/stats
   * Obtiene estadísticas del sistema de facturas
   */
  @Get('stats')
  async getStats() {
    try {
      const stats = await this.testService.getSystemStats();
      return stats;
    } catch (error) {
      this.logger.error('Error obteniendo estadísticas:', error);
      throw new HttpException(
        'Error obteniendo estadísticas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /factura/polling/stats
   * Obtiene estadísticas del servicio de polling
   */
  @Get('polling/stats')
  async getPollingStats() {
    return this.pollingService.getPollingStats();
  }

  /**
   * POST /factura/polling/force-check/:id
   * Fuerza la verificación de polling para una factura
   */
  @Post('polling/force-check/:id')
  async forceCheckPolling(@Param('id') id: string) {
    try {
      const id_factura = parseInt(id);
      await this.pollingService.forceCheckPolling(id_factura);

      return {
        message: `Verificación forzada iniciada para factura ${id_factura}`,
      };
    } catch (error) {
      this.logger.error(`Error en verificación forzada de factura ${id}:`, error);
      throw new HttpException(
        'Error en verificación forzada',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /factura/polling/stop/:id
   * Detiene el polling para una factura
   */
  @Post('polling/stop/:id')
  async stopPolling(@Param('id') id: string) {
    try {
      const id_factura = parseInt(id);
      await this.pollingService.stopPolling(id_factura);

      return {
        message: `Polling detenido para factura ${id_factura}`,
      };
    } catch (error) {
      this.logger.error(`Error deteniendo polling de factura ${id}:`, error);
      throw new HttpException(
        'Error deteniendo polling',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /factura/detector/force/:id
   * Fuerza la detección de una factura específica
   */
  @Post('detector/force/:id')
  async forceDetection(@Param('id') id: string) {
    try {
      const id_factura = parseInt(id);
      await this.detectorService.forceDetection(id_factura);

      return {
        message: `Detección forzada iniciada para factura ${id_factura}`,
      };
    } catch (error) {
      this.logger.error(`Error en detección forzada de factura ${id}:`, error);
      throw new HttpException(
        'Error en detección forzada',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /factura/detector/stats
   * Obtiene estadísticas del servicio de detección
   */
  @Get('detector/stats')
  async getDetectorStats() {
    try {
      const stats = await this.detectorService.getDetectionStats();
      return stats;
    } catch (error) {
      this.logger.error('Error obteniendo estadísticas del detector:', error);
      throw new HttpException(
        'Error obteniendo estadísticas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /factura/test/create
   * Crea una factura de prueba
   */
  @Post('test/create')
  async createTestFactura(
    @Body() body: { tipo?: number } = {},
  ) {
    try {
      const { tipo = 1 } = body;
      const id_factura = await this.testService.createTestFactura(tipo);

      return {
        message: 'Factura de prueba creada exitosamente',
        id_factura,
      };
    } catch (error) {
      this.logger.error('Error creando factura de prueba:', error);
      throw new HttpException(
        'Error creando factura de prueba',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /factura/test/sample
   * Obtiene una factura de ejemplo
   */
  @Get('test/sample')
  async getSampleFactura() {
    try {
      const sample = await this.testService.generateSampleFactura();
      return sample;
    } catch (error) {
      this.logger.error('Error generando factura de ejemplo:', error);
      throw new HttpException(
        'Error generando factura de ejemplo',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /factura/test/flow/:id
   * Prueba el flujo completo de una factura
   */
  @Post('test/flow/:id')
  async testFullFlow(@Param('id') id: string) {
    try {
      const id_factura = parseInt(id);
      await this.testService.testFullFlow(id_factura);

      return {
        message: `Prueba de flujo completo iniciada para factura ${id_factura}`,
      };
    } catch (error) {
      this.logger.error(`Error en prueba de flujo de factura ${id}:`, error);
      throw new HttpException(
        'Error en prueba de flujo',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /factura/test/validate
   * Valida la estructura de una factura
   */
  @Post('test/validate')
  async validateStructure(@Body() facturaData: any) {
    try {
      const result = await this.testService.validateFacturaStructure(facturaData);
      return result;
    } catch (error) {
      this.logger.error('Error validando estructura de factura:', error);
      throw new HttpException(
        'Error validando estructura',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /factura/reset/:id
   * Resetea una factura fallida para reintento
   */
  @Post('reset/:id')
  async resetFailedFactura(@Param('id') id: string) {
    try {
      const id_factura = parseInt(id);
      await this.testService.resetFailedFactura(id_factura);

      return {
        message: `Factura ${id_factura} reseteada exitosamente`,
      };
    } catch (error) {
      this.logger.error(`Error reseteando factura ${id}:`, error);
      throw new HttpException(
        'Error reseteando factura',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /factura/test/factura
   * Crea una factura de prueba (tipo 1)
   */
  @Post('test/factura')
  async createTestFacturaTipo1() {
    try {
      const id_factura = await this.testService.createTestFactura(1);

      return {
        message: 'Factura de prueba creada exitosamente',
        tipo: 'Factura',
        id_factura,
      };
    } catch (error) {
      this.logger.error('Error creando factura de prueba:', error);
      throw new HttpException(
        'Error creando factura de prueba',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /factura/test/boleta
   * Crea una boleta de prueba (tipo 2)
   */
  @Post('test/boleta')
  async createTestBoletaTipo2() {
    try {
      const id_factura = await this.testService.createTestBoleta();

      return {
        message: 'Boleta de prueba creada exitosamente',
        tipo: 'Boleta',
        id_factura,
      };
    } catch (error) {
      this.logger.error('Error creando boleta de prueba:', error);
      throw new HttpException(
        'Error creando boleta de prueba',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /factura/test/nota-credito
   * Crea una nota de crédito de prueba (tipo 3)
   */
  @Post('test/nota-credito')
  async createTestNotaCredito(
    @Body() body: { id_factura_origen?: number } = {},
  ) {
    try {
      const { id_factura_origen } = body;
      const id_factura =
        await this.testService.createTestNotaCredito(id_factura_origen);

      return {
        message: 'Nota de crédito de prueba creada exitosamente',
        tipo: 'Nota de Crédito',
        id_factura,
        id_factura_origen: id_factura_origen || null,
      };
    } catch (error) {
      this.logger.error('Error creando nota de crédito de prueba:', error);
      throw new HttpException(
        'Error creando nota de crédito de prueba',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /factura/test/nota-debito
   * Crea una nota de débito de prueba (tipo 4)
   */
  @Post('test/nota-debito')
  async createTestNotaDebito(
    @Body() body: { id_factura_origen?: number } = {},
  ) {
    try {
      const { id_factura_origen } = body;
      const id_factura =
        await this.testService.createTestNotaDebito(id_factura_origen);

      return {
        message: 'Nota de débito de prueba creada exitosamente',
        tipo: 'Nota de Débito',
        id_factura,
        id_factura_origen: id_factura_origen || null,
      };
    } catch (error) {
      this.logger.error('Error creando nota de débito de prueba:', error);
      throw new HttpException(
        'Error creando nota de débito de prueba',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /factura/retry-failed
   * Reintenta procesar todas las facturas fallidas
   */
  @Post('retry-failed')
  async retryFailedFacturas() {
    try {
      await this.consumerService.retryFailedRecords();

      return {
        message: 'Reintentos de facturas fallidas iniciados',
      };
    } catch (error) {
      this.logger.error('Error reintentando facturas fallidas:', error);
      throw new HttpException(
        'Error reintentando facturas fallidas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /factura/polling/:id
   * Obtiene información del polling de una factura específica
   */
  @Get('polling/:id')
  async getPollingInfo(@Param('id') id: string) {
    try {
      const id_factura = parseInt(id);
      const pollingStats = this.pollingService.getPollingStats();
      const taskInfo = pollingStats.tasks?.find(
        (task) => task.recordId === id_factura,
      );

      if (!taskInfo) {
        return {
          id_factura,
          polling: 'inactive',
          message: 'No hay polling activo para esta factura',
        };
      }

      return {
        id_factura,
        polling: 'active',
        ...taskInfo,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo info de polling de factura ${id}:`, error);
      throw new HttpException(
        'Error obteniendo información de polling',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /factura/polling/cleanup
   * Limpia tareas de polling huérfanas
   */
  @Post('polling/cleanup')
  async cleanupPolling() {
    try {
      await this.pollingService.cleanupOrphanedTasks();

      return {
        message: 'Limpieza de tareas huérfanas completada',
      };
    } catch (error) {
      this.logger.error('Error en limpieza de polling:', error);
      throw new HttpException(
        'Error en limpieza de polling',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /factura/debug/:id
   * Obtiene información de debug de una factura
   */
  @Get('debug/:id')
  async getDebugInfo(@Param('id') id: string) {
    try {
      const id_factura = parseInt(id);

      // Obtener registro de factura
      const factura = await this.prisma.factura.findUnique({
        where: { id_factura },
      });

      if (!factura) {
        throw new HttpException(
          `Factura ${id_factura} no encontrada`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Obtener info de polling si está activo
      const pollingStats = this.pollingService.getPollingStats();
      const pollingTask = pollingStats.tasks?.find(
        (task) => task.recordId === id_factura,
      );

      return {
        id_factura,
        factura: {
          tipo_de_comprobante: factura.tipo_de_comprobante,
          serie: factura.serie,
          numero: factura.numero,
          estado_factura: factura.estado_factura,
          fecha_emision: factura.fecha_emision,
          enlace: factura.enlace,
          enlace_del_pdf: factura.enlace_del_pdf,
          enlace_del_xml: factura.enlace_del_xml,
          enlace_del_cdr: factura.enlace_del_cdr,
          aceptada_por_sunat: factura.aceptada_por_sunat,
          sunat_description: factura.sunat_description,
          sunat_soap_error: factura.sunat_soap_error,
        },
        polling: pollingTask
          ? {
              active: true,
              ...pollingTask,
            }
          : {
              active: false,
              message: 'No hay polling activo',
            },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error obteniendo debug de factura ${id}:`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error obteniendo información de debug',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
