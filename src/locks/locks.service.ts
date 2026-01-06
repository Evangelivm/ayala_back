import { Injectable, Logger } from '@nestjs/common';

export interface Lock {
  resource: string;
  token: string;
  clientId: string;
  acquiredAt: number;
  expiresAt: number;
  timeout?: NodeJS.Timeout;
}

export interface AcquireLockDto {
  resource: string;
  ttl?: number; // Time to live en milisegundos (default: 30000)
  clientId: string;
}

export interface ReleaseLockDto {
  resource: string;
  token: string;
}

export interface LockResult {
  acquired: boolean;
  token?: string;
  expiresIn?: number;
  error?: string;
}

/**
 * Servicio de locks distribuidos para evitar condiciones de carrera
 *
 * NOTA: Esta implementación usa memoria local y es adecuada para un único servidor.
 * Para producción con múltiples instancias, se recomienda usar Redis con redlock.
 */
@Injectable()
export class LocksService {
  private readonly logger = new Logger(LocksService.name);
  private locks: Map<string, Lock> = new Map();
  private readonly DEFAULT_TTL = 30000; // 30 segundos
  private readonly MAX_TTL = 300000; // 5 minutos

  constructor() {
    // Limpiar locks expirados cada 10 segundos
    setInterval(() => this.cleanupExpiredLocks(), 10000);
  }

  /**
   * Adquiere un lock para un recurso específico
   */
  async acquire(dto: AcquireLockDto): Promise<LockResult> {
    const { resource, ttl = this.DEFAULT_TTL, clientId } = dto;

    // Validar TTL
    const validTtl = Math.min(ttl, this.MAX_TTL);

    // Verificar si el recurso ya está bloqueado
    const existingLock = this.locks.get(resource);

    if (existingLock) {
      const now = Date.now();

      // Si el lock expiró, eliminarlo
      if (now >= existingLock.expiresAt) {
        this.releaseLock(resource, existingLock);
      } else {
        // Lock activo por otro cliente
        const timeRemaining = existingLock.expiresAt - now;
        this.logger.warn(
          `Lock no disponible para ${resource}. Cliente ${existingLock.clientId} lo tiene por ${timeRemaining}ms más.`
        );

        return {
          acquired: false,
          error: `Recurso bloqueado por otro proceso. Expira en ${timeRemaining}ms`,
        };
      }
    }

    // Crear nuevo lock
    const token = this.generateToken();
    const now = Date.now();
    const expiresAt = now + validTtl;

    // Configurar auto-liberación
    const timeout = setTimeout(() => {
      this.logger.warn(`Lock auto-liberado por timeout: ${resource}`);
      this.releaseLock(resource, this.locks.get(resource)!);
    }, validTtl);

    const lock: Lock = {
      resource,
      token,
      clientId,
      acquiredAt: now,
      expiresAt,
      timeout,
    };

    this.locks.set(resource, lock);

    this.logger.log(
      `✅ Lock adquirido: ${resource} por cliente ${clientId} (token: ${token.substring(0, 8)}..., TTL: ${validTtl}ms)`
    );

    return {
      acquired: true,
      token,
      expiresIn: validTtl,
    };
  }

  /**
   * Libera un lock previamente adquirido
   */
  async release(dto: ReleaseLockDto): Promise<{ released: boolean; error?: string }> {
    const { resource, token } = dto;

    const lock = this.locks.get(resource);

    if (!lock) {
      this.logger.warn(`No se encontró lock para liberar: ${resource}`);
      return { released: false, error: 'Lock no encontrado' };
    }

    // Verificar que el token coincida
    if (lock.token !== token) {
      this.logger.error(
        `Token inválido al intentar liberar ${resource}. Esperado: ${lock.token.substring(0, 8)}..., Recibido: ${token.substring(0, 8)}...`
      );
      return { released: false, error: 'Token inválido' };
    }

    this.releaseLock(resource, lock);

    this.logger.log(`✅ Lock liberado: ${resource} (token: ${token.substring(0, 8)}...)`);

    return { released: true };
  }

  /**
   * Obtiene información sobre un lock específico
   */
  getLockInfo(resource: string): Lock | null {
    const lock = this.locks.get(resource);

    if (!lock) {
      return null;
    }

    const now = Date.now();

    // Si expiró, limpiarlo
    if (now >= lock.expiresAt) {
      this.releaseLock(resource, lock);
      return null;
    }

    return lock;
  }

  /**
   * Obtiene todos los locks activos
   */
  getAllLocks(): Lock[] {
    const now = Date.now();
    const activeLocks: Lock[] = [];

    for (const [resource, lock] of this.locks.entries()) {
      if (now >= lock.expiresAt) {
        // Limpiar locks expirados
        this.releaseLock(resource, lock);
      } else {
        activeLocks.push(lock);
      }
    }

    return activeLocks;
  }

  /**
   * Limpia todos los locks de un cliente específico
   */
  releaseClientLocks(clientId: string): number {
    let releasedCount = 0;

    for (const [resource, lock] of this.locks.entries()) {
      if (lock.clientId === clientId) {
        this.releaseLock(resource, lock);
        releasedCount++;
      }
    }

    if (releasedCount > 0) {
      this.logger.log(`🧹 Liberados ${releasedCount} locks del cliente ${clientId}`);
    }

    return releasedCount;
  }

  /**
   * Libera un lock internamente
   */
  private releaseLock(resource: string, lock: Lock): void {
    // Cancelar timeout
    if (lock.timeout) {
      clearTimeout(lock.timeout);
    }

    this.locks.delete(resource);
  }

  /**
   * Limpia locks expirados
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [resource, lock] of this.locks.entries()) {
      if (now >= lock.expiresAt) {
        this.releaseLock(resource, lock);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`🧹 Limpiados ${cleanedCount} locks expirados`);
    }
  }

  /**
   * Genera un token único para el lock
   */
  private generateToken(): string {
    return `lock-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Obtiene estadísticas del sistema de locks
   */
  getStats() {
    const now = Date.now();
    const locks = Array.from(this.locks.values());

    return {
      totalLocks: locks.length,
      activeLocks: locks.filter(l => now < l.expiresAt).length,
      expiredLocks: locks.filter(l => now >= l.expiresAt).length,
      locksByClient: locks.reduce((acc, lock) => {
        acc[lock.clientId] = (acc[lock.clientId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}
