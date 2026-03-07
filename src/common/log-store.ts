/**
 * Buffer estático de logs — accesible tanto desde Winston como desde
 * el logger propio de NestJS (ConsoleLogger), sin necesidad de DI.
 */

export interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'debug' | 'verbose';
  context: string;
  message: string;
}

export class LogStore {
  private static buffer: LogEntry[] = [];
  private static readonly MAX_SIZE = 800;

  static add(
    level: LogEntry['level'],
    message: string,
    context: string = '',
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleString('es-PE', {
        timeZone: 'America/Lima',
        hour12: true,
      }),
      level,
      context,
      message: String(message),
    };
    LogStore.buffer.push(entry);
    if (LogStore.buffer.length > LogStore.MAX_SIZE) {
      LogStore.buffer.shift();
    }
  }

  static getLast(n: number = 300): LogEntry[] {
    return LogStore.buffer.slice(-n);
  }

  static clear(): void {
    LogStore.buffer = [];
  }

  static get size(): number {
    return LogStore.buffer.length;
  }
}
