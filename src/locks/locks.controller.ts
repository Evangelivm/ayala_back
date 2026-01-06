import { Controller, Post, Get, Body, HttpCode, HttpStatus, Logger, Param, Delete } from '@nestjs/common';
import { LocksService, AcquireLockDto, ReleaseLockDto } from './locks.service';

@Controller('locks')
export class LocksController {
  private readonly logger = new Logger(LocksController.name);

  constructor(private readonly locksService: LocksService) {}

  /**
   * POST /api/locks/acquire
   * Adquiere un lock para un recurso específico
   */
  @Post('acquire')
  @HttpCode(HttpStatus.OK)
  async acquire(@Body() dto: AcquireLockDto) {
    this.logger.log(`Solicitud de lock para recurso: ${dto.resource} por cliente: ${dto.clientId}`);

    const result = await this.locksService.acquire(dto);

    if (result.acquired) {
      this.logger.log(`✅ Lock adquirido exitosamente para: ${dto.resource}`);
    } else {
      this.logger.warn(`❌ No se pudo adquirir lock para: ${dto.resource} - ${result.error}`);
    }

    return result;
  }

  /**
   * POST /api/locks/release
   * Libera un lock previamente adquirido
   */
  @Post('release')
  @HttpCode(HttpStatus.OK)
  async release(@Body() dto: ReleaseLockDto) {
    this.logger.log(`Solicitud de liberación de lock para: ${dto.resource}`);

    const result = await this.locksService.release(dto);

    if (result.released) {
      this.logger.log(`✅ Lock liberado exitosamente para: ${dto.resource}`);
    } else {
      this.logger.warn(`❌ No se pudo liberar lock para: ${dto.resource} - ${result.error}`);
    }

    return result;
  }

  /**
   * GET /api/locks/info/:resource
   * Obtiene información sobre un lock específico
   */
  @Get('info/:resource')
  getLockInfo(@Param('resource') resource: string) {
    const lockInfo = this.locksService.getLockInfo(resource);

    if (!lockInfo) {
      return {
        exists: false,
        message: 'Lock no encontrado o expirado',
      };
    }

    const now = Date.now();
    return {
      exists: true,
      resource: lockInfo.resource,
      clientId: lockInfo.clientId,
      acquiredAt: new Date(lockInfo.acquiredAt).toISOString(),
      expiresAt: new Date(lockInfo.expiresAt).toISOString(),
      timeRemaining: Math.max(0, lockInfo.expiresAt - now),
    };
  }

  /**
   * GET /api/locks
   * Obtiene todos los locks activos
   */
  @Get()
  getAllLocks() {
    const locks = this.locksService.getAllLocks();

    return {
      count: locks.length,
      locks: locks.map(lock => ({
        resource: lock.resource,
        clientId: lock.clientId,
        acquiredAt: new Date(lock.acquiredAt).toISOString(),
        expiresAt: new Date(lock.expiresAt).toISOString(),
        timeRemaining: Math.max(0, lock.expiresAt - Date.now()),
      })),
    };
  }

  /**
   * DELETE /api/locks/client/:clientId
   * Libera todos los locks de un cliente específico
   */
  @Delete('client/:clientId')
  releaseClientLocks(@Param('clientId') clientId: string) {
    const releasedCount = this.locksService.releaseClientLocks(clientId);

    return {
      success: true,
      message: `Liberados ${releasedCount} locks del cliente ${clientId}`,
      releasedCount,
    };
  }

  /**
   * GET /api/locks/stats
   * Obtiene estadísticas del sistema de locks
   */
  @Get('stats')
  getStats() {
    return this.locksService.getStats();
  }
}
