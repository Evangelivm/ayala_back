import { Controller, Get, Delete, Query } from '@nestjs/common';
import { LogStore, LogEntry } from '../log-store';

@Controller('admin/logs')
export class AdminLogsController {
  @Get()
  getLogs(
    @Query('last') last?: string,
    @Query('level') level?: string,
  ): { logs: LogEntry[]; total: number } {
    const n = last ? Math.min(parseInt(last), 800) : 300;
    let logs = LogStore.getLast(n);

    if (level && level !== 'all') {
      logs = logs.filter((l) => l.level === level);
    }

    return { logs, total: LogStore.size };
  }

  @Delete()
  clearLogs(): { message: string } {
    LogStore.clear();
    return { message: 'Logs limpiados' };
  }
}
