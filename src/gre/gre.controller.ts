import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
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
      const task = stats.tasks.find((t) => t.recordId === recordId);

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
  async updatePollingConfig(
    @Body() config: { interval?: number; maxAttempts?: number },
  ) {
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
      description:
        'Sistema de procesamiento GRE con Kafka y polling persistente',
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
        },
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
        modoTransporte =
          record.tipo_de_transporte === '01'
            ? 'PÚBLICO'
            : record.tipo_de_transporte === '02'
              ? 'PRIVADO'
              : 'NO DEFINIDO';
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
            completo: !!(
              record.transportista_documento_tipo === 6 &&
              record.transportista_documento_numero &&
              record.transportista_denominacion
            ),
          };
        } else if (record.tipo_de_transporte === '02') {
          // Transporte PRIVADO
          validaciones.campos_conductor = {
            documento_tipo: record.conductor_documento_tipo,
            documento_numero: record.conductor_documento_numero,
            nombre: record.conductor_nombre,
            apellidos: record.conductor_apellidos,
            licencia: record.conductor_numero_licencia,
            completo: !!(
              record.conductor_documento_tipo &&
              record.conductor_documento_numero &&
              record.conductor_nombre &&
              record.conductor_apellidos &&
              record.conductor_numero_licencia
            ),
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
          completo: !!(
            record.conductor_documento_tipo &&
            record.conductor_documento_numero &&
            record.conductor_nombre &&
            record.conductor_apellidos &&
            record.conductor_numero_licencia
          ),
        };
        validaciones.campos_destinatario = {
          documento_tipo: record.destinatario_documento_tipo,
          documento_numero: record.destinatario_documento_numero,
          denominacion: record.destinatario_denominacion,
          completo: !!(
            record.destinatario_documento_tipo &&
            record.destinatario_documento_numero &&
            record.destinatario_denominacion
          ),
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
          puede_procesarse: Object.values(validaciones).every((v) =>
            typeof v === 'boolean'
              ? v
              : typeof v === 'object' && v !== null && 'completo' in v
                ? v.completo !== false
                : true,
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

      this.logger.log(
        `📋 Creando GRE Remitente de prueba (transporte ${tipoTransporte})...`,
      );

      // Crear registro en BD
      const greRecord =
        await this.greTest.createTestGreRemitente(tipoTransporte);

      this.logger.log(`✅ GRE creado con ID: ${greRecord.id_guia}`);
      this.logger.log(
        `⏳ Esperando detección automática (máximo 30 segundos)...`,
      );

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
      this.logger.log(
        `⏳ Esperando detección automática (máximo 30 segundos)...`,
      );

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

  @Post('manual-consulta/:id')
  async manualConsultaGuia(@Param('id') id: string) {
    try {
      const recordId = parseInt(id);

      // 1. Buscar el identificador_unico en programacion_tecnica
      const programacion = await this.prisma.programacion_tecnica.findUnique({
        where: { id: recordId },
      });

      if (!programacion || !programacion.identificador_unico) {
        throw new HttpException(
          'Registro de programación no encontrado o sin identificador único',
          HttpStatus.NOT_FOUND,
        );
      }

      // 2. Buscar guía en BD usando el identificador_unico
      const guia = await this.prisma.guia_remision.findFirst({
        where: { identificador_unico: programacion.identificador_unico },
      });

      if (!guia) {
        throw new HttpException('Guía no encontrada', HttpStatus.NOT_FOUND);
      }

      // 2.1. Validar estado de la guía
      if (
        !guia.estado_gre ||
        guia.estado_gre === 'PENDIENTE' ||
        guia.estado_gre === 'FALLADO'
      ) {
        this.logger.log(
          `⚠️ Guía ${guia.serie}-${guia.numero} tiene estado: ${guia.estado_gre || 'NULL'}`,
        );
        throw new HttpException(
          `La guía ${guia.serie}-${guia.numero} no ha sido generada exitosamente en Nubefact. ` +
            `Estado actual: ${guia.estado_gre || 'NO PROCESADO'}. ` +
            `Por favor, genere la guía primero antes de intentar recuperar archivos.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 3. Preparar datos para consultar_guia
      const consultaData = {
        operacion: 'consultar_guia',
        tipo_de_comprobante: guia.tipo_de_comprobante,
        serie: guia.serie,
        numero: guia.numero,
      };

      this.logger.log(
        `📋 Consultando guía manualmente: ${guia.serie}-${guia.numero}`,
      );

      // 4. Llamar a NUBEFACT consultar_guia
      const NUBEFACT_CONSULTAR_URL = process.env.NUBEFACT_CONSULTAR_URL;
      const NUBEFACT_TOKEN = process.env.NUBEFACT_TOKEN;

      const axios = require('axios');
      const response = await axios.post(NUBEFACT_CONSULTAR_URL, consultaData, {
        headers: {
          Authorization: `Token ${NUBEFACT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      // 5. Verificar si tenemos enlaces
      const {
        enlace_del_pdf,
        enlace_del_xml,
        enlace_del_cdr,
        aceptada_por_sunat,
        sunat_description,
      } = response.data;

      if (!enlace_del_pdf || !enlace_del_xml || !enlace_del_cdr) {
        this.logger.log(
          `⚠️ SUNAT aún no ha generado los archivos para ${guia.serie}-${guia.numero}`,
        );
        return {
          success: false,
          message:
            'SUNAT aún no ha generado los archivos. Intente nuevamente en unos minutos.',
          data: response.data,
        };
      }

      // 6. Actualizar BD con los enlaces
      const guiaActualizada = await this.prisma.guia_remision.update({
        where: { id_guia: guia.id_guia },
        data: {
          estado_gre: 'COMPLETADO',
          enlace_del_pdf,
          enlace_del_xml,
          enlace_del_cdr,
          aceptada_por_sunat,
          sunat_description,
        },
      });

      this.logger.log(
        `✅ Enlaces recuperados exitosamente para ${guia.serie}-${guia.numero}`,
      );

      return {
        success: true,
        message: 'Enlaces recuperados exitosamente',
        data: {
          id_guia: guiaActualizada.id_guia,
          serie: guiaActualizada.serie,
          numero: guiaActualizada.numero,
          estado_gre: guiaActualizada.estado_gre,
          enlace_del_pdf,
          enlace_del_xml,
          enlace_del_cdr,
        },
      };
    } catch (error) {
      this.logger.error('Error en consulta manual:', error);

      // Manejo específico para error de Nubefact "Documento no existe"
      if (
        error.response?.status === 400 &&
        error.response?.data?.errors === 'Documento no existe'
      ) {
        const guia = await this.prisma.guia_remision.findFirst({
          where: {
            identificador_unico: (
              await this.prisma.programacion_tecnica.findUnique({
                where: { id: parseInt(id) },
              })
            )?.identificador_unico,
          },
        });

        this.logger.log(
          `⚠️ Guía ${guia?.serie}-${guia?.numero} no existe en Nubefact. Estado actual: ${guia?.estado_gre}`,
        );

        throw new HttpException(
          `El documento ${guia?.serie}-${guia?.numero} NO EXISTE en Nubefact. ` +
            `La guía nunca fue enviada correctamente o el proceso falló. ` +
            `Debe generar la guía nuevamente desde el inicio.`,
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        `Error en consulta manual: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('test/info')
  getTestInfo() {
    return {
      title: '🧪 ENDPOINTS DE PRUEBA PARA KAFKA GRE',
      description:
        'Estos endpoints crean GREs de prueba con datos precargados para validar el flujo completo',
      endpoints: {
        remitente_privado: {
          method: 'POST',
          url: '/gre/test/remitente?tipo=privado',
          descripcion:
            'Crea GRE Remitente con transporte PRIVADO (tipo_de_transporte=02)',
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
          descripcion:
            'Crea GRE Remitente con transporte PÚBLICO (tipo_de_transporte=01)',
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
        paso_1:
          '📝 Endpoint crea registro en guia_remision con estado_gre = NULL',
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
        force:
          'POST /gre/force-detection - Forzar detección inmediata (no esperar 30s)',
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

  @Post('extendido/procesar-pendientes')
  async procesarPendientesExtendidos() {
    try {
      this.logger.log(
        '🚨 PROCESAMIENTO DE EMERGENCIA - Procesando registros pendientes extendidos',
      );

      // 1. Buscar registros con estado PENDIENTE
      const pendientes = await this.prisma.guia_remision_extendido.findMany({
        where: { estado_gre: 'PENDIENTE' },
        take: 10, // Procesar máximo 10 a la vez
      });

      if (pendientes.length === 0) {
        return {
          success: true,
          message: 'No hay registros pendientes para procesar',
          procesados: 0,
        };
      }

      this.logger.log(
        `📋 Encontrados ${pendientes.length} registros pendientes`,
      );

      const resultados: Array<{
        id_guia: number;
        serie?: string;
        numero?: number;
        status: string;
        mensaje: string;
      }> = [];

      for (const guia of pendientes) {
        try {
          this.logger.log(`🔄 Procesando guía extendida ID: ${guia.id_guia}`);

          // 2. Actualizar a PROCESANDO
          await this.prisma.guia_remision_extendido.update({
            where: { id_guia: guia.id_guia },
            data: { estado_gre: 'PROCESANDO' },
          });

          // 3. Preparar datos para NUBEFACT generar_guia
          const greData: any = {
            operacion: 'generar_guia',
            tipo_de_comprobante: guia.tipo_de_comprobante,
            serie: guia.serie,
            numero: guia.numero,
            fecha_de_emision: guia.fecha_de_emision,
          };

          // Agregar todos los campos necesarios según el tipo
          if (guia.tipo_de_comprobante === 7) {
            Object.assign(greData, {
              observaciones: guia.observaciones,
              motivo_de_traslado: guia.motivo_de_traslado,
              peso_bruto_total: guia.peso_bruto_total,
              numero_de_bultos: guia.numero_de_bultos,
              tipo_de_transporte: guia.tipo_de_transporte,
              fecha_de_inicio_de_traslado: guia.fecha_de_inicio_de_traslado,
              transportista_documento_tipo: guia.transportista_documento_tipo,
              transportista_documento_numero:
                guia.transportista_documento_numero,
              transportista_denominacion: guia.transportista_denominacion,
              conductor_documento_tipo: guia.conductor_documento_tipo,
              conductor_documento_numero: guia.conductor_documento_numero,
              conductor_nombre: guia.conductor_nombre,
              conductor_apellidos: guia.conductor_apellidos,
              conductor_numero_licencia: guia.conductor_numero_licencia,
              vehiculo_placa_numero: guia.transportista_placa_numero,
              destinatario_documento_tipo: guia.destinatario_documento_tipo,
              destinatario_documento_numero: guia.destinatario_documento_numero,
              destinatario_denominacion: guia.destinatario_denominacion,
              punto_de_partida_ubigeo: guia.punto_de_partida_ubigeo,
              punto_de_partida_direccion: guia.punto_de_partida_direccion,
              punto_de_llegada_ubigeo: guia.punto_de_llegada_ubigeo,
              punto_de_llegada_direccion: guia.punto_de_llegada_direccion,
            });
          } else if (guia.tipo_de_comprobante === 8) {
            Object.assign(greData, {
              observaciones: guia.observaciones,
              peso_bruto_total: guia.peso_bruto_total,
              numero_de_bultos: guia.numero_de_bultos,
              fecha_de_inicio_de_traslado: guia.fecha_de_inicio_de_traslado,
              conductor_documento_tipo: guia.conductor_documento_tipo,
              conductor_documento_numero: guia.conductor_documento_numero,
              conductor_nombre: guia.conductor_nombre,
              conductor_apellidos: guia.conductor_apellidos,
              conductor_numero_licencia: guia.conductor_numero_licencia,
              vehiculo_placa_numero: guia.transportista_placa_numero,
              destinatario_documento_tipo: guia.destinatario_documento_tipo,
              destinatario_documento_numero: guia.destinatario_documento_numero,
              destinatario_denominacion: guia.destinatario_denominacion,
              punto_de_partida_ubigeo: guia.punto_de_partida_ubigeo,
              punto_de_partida_direccion: guia.punto_de_partida_direccion,
              punto_de_llegada_ubigeo: guia.punto_de_llegada_ubigeo,
              punto_de_llegada_direccion: guia.punto_de_llegada_direccion,
              tuc_vehiculo_principal: guia.tuc_vehiculo_principal,
            });
          }

          // 4. Obtener items - usar tabla correcta
          const items: any[] = await this.prisma.$queryRaw`
            SELECT * FROM guia_remision_items_extendido WHERE id_guia = ${guia.id_guia}
          `;

          greData.items = items.map((item: any) => ({
            unidad_de_medida: item.unidad_de_medida,
            codigo: item.codigo,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            codigo_producto_sunat: item.codigo_producto_sunat,
          }));

          // 5. Llamar a NUBEFACT generar_guia
          const NUBEFACT_API_URL =
            process.env.NUBEFACT_API_URL ||
            'https://api.nubefact.com/api/v1/generar_guia';
          const NUBEFACT_TOKEN = process.env.NUBEFACT_TOKEN;

          const axios = require('axios');
          const response = await axios.post(NUBEFACT_API_URL, greData, {
            headers: {
              Authorization: `Token ${NUBEFACT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          });

          this.logger.log(
            `✅ Llamada a generar_guia exitosa para ID: ${guia.id_guia}`,
          );

          // 6. Iniciar polling inmediato (intento de consultar_guia después de 5 segundos)
          setTimeout(async () => {
            await this.consultarYActualizarExtendido(
              guia.id_guia,
              guia.identificador_unico,
              guia.serie,
              guia.numero,
              guia.tipo_de_comprobante,
            );
          }, 5000);

          resultados.push({
            id_guia: guia.id_guia,
            serie: guia.serie,
            numero: guia.numero,
            status: 'procesado',
            mensaje: 'Enviado a NUBEFACT, iniciando polling',
          });
        } catch (error) {
          this.logger.error(
            `Error procesando guía extendida ${guia.id_guia}:`,
            error,
          );

          await this.prisma.guia_remision_extendido.update({
            where: { id_guia: guia.id_guia },
            data: { estado_gre: 'FALLADO' },
          });

          resultados.push({
            id_guia: guia.id_guia,
            status: 'error',
            mensaje: error.message,
          });
        }
      }

      return {
        success: true,
        message: `Procesados ${resultados.length} registros`,
        resultados,
      };
    } catch (error) {
      this.logger.error('Error en procesamiento de emergencia:', error);
      throw new HttpException(
        `Error procesando pendientes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async consultarYActualizarExtendido(
    idGuia: number,
    identificadorUnico: string | null,
    serie: string,
    numero: number,
    tipoComprobante: number,
  ) {
    try {
      const consultaData = {
        operacion: 'consultar_guia',
        tipo_de_comprobante: tipoComprobante,
        serie: serie,
        numero: numero,
      };

      const NUBEFACT_CONSULTAR_URL = process.env.NUBEFACT_CONSULTAR_URL;
      const NUBEFACT_TOKEN = process.env.NUBEFACT_TOKEN;

      const axios = require('axios');
      const response = await axios.post(NUBEFACT_CONSULTAR_URL, consultaData, {
        headers: {
          Authorization: `Token ${NUBEFACT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      const {
        enlace_del_pdf,
        enlace_del_xml,
        enlace_del_cdr,
        aceptada_por_sunat,
        sunat_description,
      } = response.data;

      if (
        enlace_del_pdf &&
        enlace_del_xml &&
        enlace_del_cdr &&
        aceptada_por_sunat === true
      ) {
        // Actualizar BD
        const guiaCompletada = await this.prisma.guia_remision_extendido.update(
          {
            where: { id_guia: idGuia },
            data: {
              estado_gre: 'COMPLETADO',
              enlace_del_pdf,
              enlace_del_xml,
              enlace_del_cdr,
            },
          },
        );

        this.logger.log(
          `✅ Guía extendida ${serie}-${numero} COMPLETADA con archivos`,
        );

        // Emitir WebSocket si tiene identificador
        if (identificadorUnico) {
          const programacionTecnica =
            await this.prisma.programacion_tecnica.findFirst({
              where: { identificador_unico: identificadorUnico },
              select: { id: true },
            });

          if (programacionTecnica) {
            // Importar WebsocketGateway
            const {
              WebsocketGateway,
            } = require('../websocket/websocket.gateway');
            const websocketGateway = new WebsocketGateway();

            websocketGateway.emitProgTecnicaCompletada({
              id: programacionTecnica.id,
              identificador_unico: identificadorUnico,
              pdf_link: enlace_del_pdf,
              xml_link: enlace_del_xml,
              cdr_link: enlace_del_cdr,
            });

            this.logger.log(
              `📡 WebSocket emitido para identificador: ${identificadorUnico}`,
            );
          }
        }
      } else {
        this.logger.log(
          `⏳ Archivos aún no disponibles para ${serie}-${numero}, reintentando en 30s...`,
        );
        // Reintentar después de 30 segundos
        setTimeout(async () => {
          await this.consultarYActualizarExtendido(
            idGuia,
            identificadorUnico,
            serie,
            numero,
            tipoComprobante,
          );
        }, 30000);
      }
    } catch (error) {
      this.logger.error(
        `Error consultando guía extendida ${serie}-${numero}:`,
        error,
      );
      // Reintentar después de 30 segundos si falla
      setTimeout(async () => {
        await this.consultarYActualizarExtendido(
          idGuia,
          identificadorUnico,
          serie,
          numero,
          tipoComprobante,
        );
      }, 30000);
    }
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
