import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { join } from 'path';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;
  private context?: string;

  constructor() {
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const logDir = join(process.cwd(), 'logs');

    // Formato personalizado
    const customFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    );

    // Formato para consola (desarrollo)
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, context, trace, ...metadata }) => {
        let msg = `${timestamp} [${level}]`;
        if (context) msg += ` [${context}]`;
        msg += `: ${message}`;
        if (trace) msg += `\n${trace}`;
        if (Object.keys(metadata).length > 0) {
          msg += `\n${JSON.stringify(metadata, null, 2)}`;
        }
        return msg;
      })
    );

    // Transports
    const transports: winston.transport[] = [
      // Consola (solo en desarrollo)
      new winston.transports.Console({
        format: consoleFormat,
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
      })
    ];

    // Solo agregar archivos en producción o si se especifica
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
      // Archivo de errores
      transports.push(
        new DailyRotateFile({
          filename: join(logDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          format: customFormat,
          maxSize: '20m',
          maxFiles: '30d',
          zippedArchive: true
        })
      );

      // Archivo combinado (todos los niveles)
      transports.push(
        new DailyRotateFile({
          filename: join(logDir, 'combined-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          format: customFormat,
          maxSize: '20m',
          maxFiles: '30d',
          zippedArchive: true
        })
      );

      // Archivo de warnings
      transports.push(
        new DailyRotateFile({
          filename: join(logDir, 'warn-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'warn',
          format: customFormat,
          maxSize: '20m',
          maxFiles: '30d',
          zippedArchive: true
        })
      );
    }

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: customFormat,
      transports,
      exceptionHandlers: [
        new winston.transports.File({
          filename: join(logDir, 'exceptions.log'),
          format: customFormat
        })
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: join(logDir, 'rejections.log'),
          format: customFormat
        })
      ]
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: string): void {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, {
      context: context || this.context,
      trace
    });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context: context || this.context });
  }

  // Métodos adicionales para logging estructurado
  logWithMetadata(level: string, message: string, metadata: Record<string, any>, context?: string): void {
    this.logger.log(level, message, {
      context: context || this.context,
      ...metadata
    });
  }

  // Para Factura específicamente
  logFacturaEvent(event: string, facturaId: number, data?: Record<string, any>): void {
    this.logger.info(`Factura Event: ${event}`, {
      context: 'FacturaModule',
      facturaId,
      event,
      ...data
    });
  }

  logNubefactRequest(method: string, endpoint: string, data?: Record<string, any>): void {
    this.logger.debug(`NUBEFACT Request: ${method} ${endpoint}`, {
      context: 'NubefactService',
      method,
      endpoint,
      ...data
    });
  }

  logNubefactResponse(endpoint: string, status: number, data?: Record<string, any>): void {
    const level = status >= 400 ? 'error' : 'debug';
    this.logger.log(level, `NUBEFACT Response: ${endpoint} - Status ${status}`, {
      context: 'NubefactService',
      endpoint,
      status,
      ...data
    });
  }

  logKafkaEvent(event: string, topic: string, data?: Record<string, any>): void {
    this.logger.debug(`Kafka Event: ${event} - Topic: ${topic}`, {
      context: 'KafkaService',
      event,
      topic,
      ...data
    });
  }

  logPollingEvent(facturaId: number, attempt: number, status: string, data?: Record<string, any>): void {
    this.logger.debug(`Polling Attempt #${attempt} for Factura ${facturaId}: ${status}`, {
      context: 'PollingService',
      facturaId,
      attempt,
      status,
      ...data
    });
  }
}
