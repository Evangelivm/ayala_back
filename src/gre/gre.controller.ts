import { Controller, Get, Post, Param, Body, HttpException, HttpStatus, Query } from '@nestjs/common';
import { GreDetectorService } from './services/gre-detector.service';
import { GreConsumerService } from './services/gre-consumer.service';
import { GrePollingService } from './services/gre-polling.service';
import { GreProducerService } from './services/gre-producer.service';
import { GreTestService } from './services/gre-test.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('gre')
export class GreController {

  constructor(
    private readonly greDetector: GreDetectorService,
    private readonly greConsumer: GreConsumerService,
    private readonly grePolling: GrePollingService,
    private readonly greProducer: GreProducerService,
    private readonly greTest: GreTestService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  async getStatus() {
    try {
      const [detectionStats, consumerStats, pollingStats] = await Promise.all([
        this.greDetector.getDetectionStats(),
        this.greConsumer.getConsumerStats(),
        this.grePolling.getPollingStats(),
      ]);

      return {
        status: 'OK',
        timestamp: new Date().toISOString(),
        detection: detectionStats,
        consumer: consumerStats,
        polling: pollingStats,
      };
    } catch (error) {
      throw new HttpException(
        `Error obteniendo estado GRE: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats')
  async getDetailedStats() {
    try {
      const detectionStats = await this.greDetector.getDetectionStats();
      const consumerStats = await this.greConsumer.getConsumerStats();
      const pollingStats = this.grePolling.getPollingStats();

      return {
        summary: {
          total: detectionStats.total,
          pendientes: detectionStats.pendientes,
          procesando: detectionStats.procesando,
          completados: detectionStats.completados,
          fallados: detectionStats.fallados,
          sinProcesar: detectionStats.sinProcesar,
        },
        polling: {
          activos: pollingStats.activeCount,
          intervalo: pollingStats.pollingInterval,
          maxIntentos: pollingStats.maxAttempts,
          tareas: pollingStats.tasks,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        `Error obteniendo estadísticas: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('force-detection')
  async forceDetection() {
    try {
      await this.greDetector.forceDetection();

      return {
        success: true,
        message: 'Detección forzada ejecutada',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        `Error en detección forzada: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('retry-failed')
  async retryFailedRecords() {
    try {
      await this.greConsumer.retryFailedRecords();

      return {
        success: true,
        message: 'Registros fallidos reseteados para reintento',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        `Error reintentando registros fallidos: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('polling/:recordId')
  async getPollingStatus(@Param('recordId') recordId: string) {
    try {
      const stats = this.grePolling.getPollingStats();
      const task = stats.tasks.find(t => t.recordId === recordId);

      if (!task) {
        return {
          recordId,
          status: 'not_polling',
          message: 'No hay polling activo para este registro',
        };
      }

      return {
        recordId,
        status: 'polling_active',
        messageId: task.messageId,
        startTime: task.startTime,
        runTime: task.runTime,
        attemptCount: task.attemptCount,
        maxAttempts: task.maxAttempts,
        progress: task.progress,
      };
    } catch (error) {
      throw new HttpException(
        `Error obteniendo estado de polling: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('polling/:recordId/force-check')
  async forcePollingCheck(@Param('recordId') recordId: string) {
    try {
      await this.grePolling.forceCheckPolling(recordId);

      return {
        success: true,
        message: `Verificación forzada de polling ejecutada para registro ${recordId}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        `Error en verificación forzada: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('polling/cleanup')
  async cleanupPolling() {
    try {
      await this.grePolling.cleanupOrphanedTasks();

      return {
        success: true,
        message: 'Limpieza de tasks huérfanas ejecutada',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        `Error en limpieza: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('config/polling')
  async updatePollingConfig(@Body() config: { interval?: number; maxAttempts?: number }) {
    try {
      this.grePolling.updatePollingConfig(config.interval, config.maxAttempts);

      return {
        success: true,
        message: 'Configuración de polling actualizada',
        config: {
          interval: config.interval,
          maxAttempts: config.maxAttempts,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        `Error actualizando configuración: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  async healthCheck() {
    try {
      // Verificaciones básicas de salud
      const stats = await this.greDetector.getDetectionStats();
      const pollingCount = this.grePolling.getActivePollingCount();

      const health = {
        status: 'healthy',
        checks: {
          database: stats.total >= 0 ? 'OK' : 'ERROR',
          polling: pollingCount >= 0 ? 'OK' : 'ERROR',
          kafka: 'OK', // TODO: Implementar check real de Kafka
        },
        metrics: {
          totalRecords: stats.total,
          activePolling: pollingCount,
        },
        timestamp: new Date().toISOString(),
      };

      const hasErrors = Object.values(health.checks).includes('ERROR');

      if (hasErrors) {
        throw new HttpException(health, HttpStatus.SERVICE_UNAVAILABLE);
      }

      return health;
    } catch (error) {
      throw new HttpException(
        `Error en health check: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('version')
  getVersion() {
    return {
      service: 'GRE Kafka Service',
      version: '1.0.0',
      description: 'Sistema de procesamiento GRE con Kafka y polling persistente',
      features: [
        'Detección automática de registros completos',
        'Procesamiento asíncrono con Kafka',
        'Polling persistente para consultar_guia',
        'Integración con NUBEFACT API',
        'Monitoreo en tiempo real',
      ],
      endpoints: {
        status: 'GET /gre/status',
        stats: 'GET /gre/stats',
        health: 'GET /gre/health',
        forceDetection: 'POST /gre/force-detection',
        retryFailed: 'POST /gre/retry-failed',
        testRemitente: 'POST /gre/test/remitente',
        testTransportista: 'POST /gre/test/transportista',
        debug: 'GET /gre/debug/:id',
      },
    };
  }

  @Get('debug/:id')
  async debugRecord(@Param('id') id: string) {
    try {
      const recordId = parseInt(id);

      const record = await this.prisma.guia_remision.findUnique({
        where: { id_guia: recordId },
        include: {
          items: true,
          documento_relacionado: true,
          vehiculos_secundarios: true,
          conductores_secundarios: true,
        }
      });

      if (!record) {
        throw new HttpException(
          `Registro ${id} no encontrado`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Determinar tipo de GRE
      let tipoGre = 'DESCONOCIDO';
      let modoTransporte: string | null = null;

      if (record.tipo_de_comprobante === 7) {
        tipoGre = 'GRE REMITENTE';
        modoTransporte = record.tipo_de_transporte === '01' ? 'PÚBLICO' :
                        record.tipo_de_transporte === '02' ? 'PRIVADO' :
                        'NO DEFINIDO';
      } else if (record.tipo_de_comprobante === 8) {
        tipoGre = 'GRE TRANSPORTISTA';
      }

      // Verificar campos requeridos según tipo
      const validaciones: any = {
        tiene_operacion: !!record.operacion,
        tiene_serie: !!record.serie && record.serie.length === 4,
        tiene_numero: !!record.numero && record.numero > 0,
        tiene_items: record.items && record.items.length > 0,
      };

      if (record.tipo_de_comprobante === 7) {
        // Validaciones GRE Remitente
        validaciones.tiene_motivo_traslado = !!record.motivo_de_traslado;
        validaciones.tiene_numero_bultos = !!record.numero_de_bultos;
        validaciones.tiene_tipo_transporte = !!record.tipo_de_transporte;

        if (record.tipo_de_transporte === '01') {
          // Transporte PÚBLICO
          validaciones.campos_transportista = {
            documento_tipo: record.transportista_documento_tipo,
            documento_numero: record.transportista_documento_numero,
            denominacion: record.transportista_denominacion,
            completo: !!(record.transportista_documento_tipo === 6 &&
                        record.transportista_documento_numero &&
                        record.transportista_denominacion)
          };
        } else if (record.tipo_de_transporte === '02') {
          // Transporte PRIVADO
          validaciones.campos_conductor = {
            documento_tipo: record.conductor_documento_tipo,
            documento_numero: record.conductor_documento_numero,
            nombre: record.conductor_nombre,
            apellidos: record.conductor_apellidos,
            licencia: record.conductor_numero_licencia,
            completo: !!(record.conductor_documento_tipo &&
                        record.conductor_documento_numero &&
                        record.conductor_nombre &&
                        record.conductor_apellidos &&
                        record.conductor_numero_licencia)
          };
        }
      } else if (record.tipo_de_comprobante === 8) {
        // Validaciones GRE Transportista
        validaciones.campos_conductor = {
          documento_tipo: record.conductor_documento_tipo,
          documento_numero: record.conductor_documento_numero,
          nombre: record.conductor_nombre,
          apellidos: record.conductor_apellidos,
          licencia: record.conductor_numero_licencia,
          completo: !!(record.conductor_documento_tipo &&
                      record.conductor_documento_numero &&
                      record.conductor_nombre &&
                      record.conductor_apellidos &&
                      record.conductor_numero_licencia)
        };
        validaciones.campos_destinatario = {
          documento_tipo: record.destinatario_documento_tipo,
          documento_numero: record.destinatario_documento_numero,
          denominacion: record.destinatario_denominacion,
          completo: !!(record.destinatario_documento_tipo &&
                      record.destinatario_documento_numero &&
                      record.destinatario_denominacion)
        };
      }

      return {
        id_guia: record.id_guia,
        tipo_gre: tipoGre,
        modo_transporte: modoTransporte,
        estado_gre: record.estado_gre,
        serie: record.serie,
        numero: record.numero,
        validaciones,
        resumen: {
          puede_procesarse: Object.values(validaciones).every(v =>
            typeof v === 'boolean' ? v : (typeof v === 'object' && v !== null && 'completo' in v ? v.completo !== false : true)
          ),
          items_count: record.items?.length || 0,
          documentos_relacionados: record.documento_relacionado?.length || 0,
          vehiculos_secundarios: record.vehiculos_secundarios?.length || 0,
          conductores_secundarios: record.conductores_secundarios?.length || 0,
        },
        campos_completos: record,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Error obteniendo debug del registro: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ========================================
  // ENDPOINTS DE PRUEBA
  // ========================================

  @Post('test/remitente')
  async createTestGreRemitente(@Query('tipo') tipo?: 'privado' | 'publico') {
    try {
      const tipoTransporte = tipo || 'privado';

      this.logger.log(`📋 Creando GRE Remitente de prueba (transporte ${tipoTransporte})...`);

      // Crear registro en BD
      const greRecord = await this.greTest.createTestGreRemitente(tipoTransporte);

      this.logger.log(`✅ GRE creado con ID: ${greRecord.id_guia}`);
      this.logger.log(`⏳ Esperando detección automática (máximo 30 segundos)...`);

      return {
        success: true,
        message: `GRE Remitente de prueba creado exitosamente (${tipoTransporte})`,
        data: {
          id_guia: greRecord.id_guia,
          tipo_de_comprobante: greRecord.tipo_de_comprobante,
          serie: greRecord.serie,
          numero: greRecord.numero,
          tipo_transporte: tipoTransporte,
          estado_gre: greRecord.estado_gre,
          items_count: greRecord.items.length,
          documentos_relacionados: greRecord.documento_relacionado?.length || 0,
        },
        instrucciones: {
          paso_1: `GRE insertado en BD con estado_gre = NULL`,
          paso_2: `Detector lo encontrará automáticamente en máximo 30 segundos`,
          paso_3: `Cambiará a PENDIENTE y lo enviará a Kafka`,
          paso_4: `Consumer procesará y empezará polling a NUBEFACT`,
          paso_5: `Cuando obtenga PDF/XML/CDR cambiará a COMPLETADO`,
          monitoreo: {
            status: `GET /gre/status - Ver estado general`,
            stats: `GET /gre/stats - Ver estadísticas detalladas`,
            polling: `GET /gre/polling/${greRecord.id_guia} - Ver estado del polling`,
            forceDetection: `POST /gre/force-detection - Forzar detección inmediata`,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error creando GRE Remitente de prueba:', error);
      throw new HttpException(
        `Error creando GRE de prueba: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('test/transportista')
  async createTestGreTransportista() {
    try {
      this.logger.log(`📋 Creando GRE Transportista de prueba...`);

      // Crear registro en BD
      const greRecord = await this.greTest.createTestGreTransportista();

      this.logger.log(`✅ GRE creado con ID: ${greRecord.id_guia}`);
      this.logger.log(`⏳ Esperando detección automática (máximo 30 segundos)...`);

      return {
        success: true,
        message: 'GRE Transportista de prueba creado exitosamente',
        data: {
          id_guia: greRecord.id_guia,
          tipo_de_comprobante: greRecord.tipo_de_comprobante,
          serie: greRecord.serie,
          numero: greRecord.numero,
          estado_gre: greRecord.estado_gre,
          items_count: greRecord.items.length,
          documentos_relacionados: greRecord.documento_relacionado?.length || 0,
          tiene_tuc: !!greRecord.tuc_vehiculo_principal,
        },
        instrucciones: {
          paso_1: `GRE insertado en BD con estado_gre = NULL`,
          paso_2: `Detector lo encontrará automáticamente en máximo 30 segundos`,
          paso_3: `Cambiará a PENDIENTE y lo enviará a Kafka`,
          paso_4: `Consumer procesará y empezará polling a NUBEFACT`,
          paso_5: `Cuando obtenga PDF/XML/CDR cambiará a COMPLETADO`,
          monitoreo: {
            status: `GET /gre/status - Ver estado general`,
            stats: `GET /gre/stats - Ver estadísticas detalladas`,
            polling: `GET /gre/polling/${greRecord.id_guia} - Ver estado del polling`,
            forceDetection: `POST /gre/force-detection - Forzar detección inmediata`,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error creando GRE Transportista de prueba:', error);
      throw new HttpException(
        `Error creando GRE de prueba: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('test/info')
  getTestInfo() {
    return {
      title: '🧪 ENDPOINTS DE PRUEBA PARA KAFKA GRE',
      description: 'Estos endpoints crean GREs de prueba con datos precargados para validar el flujo completo',
      endpoints: {
        remitente_privado: {
          method: 'POST',
          url: '/gre/test/remitente?tipo=privado',
          descripcion: 'Crea GRE Remitente con transporte PRIVADO (tipo_de_transporte=02)',
          campos_obligatorios: [
            'motivo_de_traslado',
            'numero_de_bultos',
            'tipo_de_transporte',
            'conductor_* (todos los campos del conductor)',
          ],
        },
        remitente_publico: {
          method: 'POST',
          url: '/gre/test/remitente?tipo=publico',
          descripcion: 'Crea GRE Remitente con transporte PÚBLICO (tipo_de_transporte=01)',
          campos_obligatorios: [
            'motivo_de_traslado',
            'numero_de_bultos',
            'tipo_de_transporte',
            'transportista_* (RUC, denominación)',
          ],
        },
        transportista: {
          method: 'POST',
          url: '/gre/test/transportista',
          descripcion: 'Crea GRE Transportista (tipo_de_comprobante=8)',
          campos_obligatorios: [
            'conductor_* (obligatorio siempre)',
            'destinatario_* (obligatorio siempre)',
            'tuc_vehiculo_principal (opcional)',
          ],
        },
      },
      flujo_automatico: {
        paso_1: '📝 Endpoint crea registro en guia_remision con estado_gre = NULL',
        paso_2: '🔍 Detector encuentra el registro (máximo 30 segundos)',
        paso_3: '✅ Valida campos según tipo_de_comprobante (7 u 8)',
        paso_4: '📤 Envía a Kafka topic: gre-requests',
        paso_5: '⚙️ Consumer llama generar_guia de NUBEFACT',
        paso_6: '🔄 Inicia polling persistente (consultar_guia)',
        paso_7: '🎉 Obtiene PDF/XML/CDR y marca como COMPLETADO',
      },
      monitoreo: {
        status: 'GET /gre/status - Estado general del sistema',
        stats: 'GET /gre/stats - Estadísticas detalladas',
        polling: 'GET /gre/polling/:id - Estado de polling específico',
        force: 'POST /gre/force-detection - Forzar detección inmediata (no esperar 30s)',
      },
      notas: [
        '⚠️ Los datos son FICTICIOS para pruebas',
        '⚠️ Validar RUC/DNI/ubigeos reales antes de producción',
        '⚠️ Configurar NUBEFACT_TOKEN en variables de entorno',
        '✅ Kafka debe estar corriendo en localhost:9092',
        '✅ MySQL debe estar corriendo con las tablas creadas',
      ],
    };
  }

  private readonly logger = new (class {
    log(message: string) {
      console.log(`[GreController] ${message}`);
    }
    error(message: string, error?: any) {
      console.error(`[GreController] ${message}`, error);
    }
  })();
}