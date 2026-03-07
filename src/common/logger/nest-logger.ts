import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { LogStore } from '../log-store';

/**
 * Logger personalizado para NestJS — captura los logs del framework
 * (rutas, lifecycle, Kafka, etc.) y los guarda en el LogStore
 * además de mostrarlos en la consola con el formato estándar de NestJS.
 */
export class NestAppLogger extends ConsoleLogger {
  log(message: any, context?: string): void {
    super.log(message, context);
    LogStore.add('log', String(message), context ?? '');
  }

  warn(message: any, context?: string): void {
    super.warn(message, context);
    LogStore.add('warn', String(message), context ?? '');
  }

  error(message: any, stack?: string, context?: string): void {
    super.error(message, stack, context);
    LogStore.add('error', stack ? `${message}\n${stack}` : String(message), context ?? '');
  }

  debug(message: any, context?: string): void {
    super.debug(message, context);
    LogStore.add('debug', String(message), context ?? '');
  }

  verbose(message: any, context?: string): void {
    super.verbose(message, context);
    LogStore.add('verbose', String(message), context ?? '');
  }
}
