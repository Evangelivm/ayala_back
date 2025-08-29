import { Controller, Get, Query, HttpException, HttpStatus, UsePipes } from '@nestjs/common';
import { DashboardService, DashboardStats } from './dashboard.service';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { GetActivityQuerySchema, GetRecentReportsQuerySchema } from '../dto/dashboard.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(): Promise<DashboardStats> {
    try {
      return await this.dashboardService.getStats();
    } catch (error) {
      console.error('Dashboard stats error:', error);
      throw new HttpException(
        'Error al obtener estadísticas del dashboard',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('recent-reports')
  @UsePipes(new ZodValidationPipe(GetRecentReportsQuerySchema))
  async getRecentReports(@Query() query: { limit?: string }) {
    try {
      const limitNumber = Math.max(1, Math.min(50, parseInt(query.limit || '10')));
      return await this.dashboardService.getRecentReports(limitNumber);
    } catch (error) {
      console.error('Recent reports error:', error);
      throw new HttpException(
        'Error al obtener reportes recientes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('activity')
  @UsePipes(new ZodValidationPipe(GetActivityQuerySchema))
  async getActivity(@Query() query: { period?: 'day' | 'week' | 'month' }) {
    try {
      return await this.dashboardService.getActivityByPeriod(query.period || 'week');
    } catch (error) {
      console.error('Activity error:', error);
      throw new HttpException(
        'Error al obtener datos de actividad',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('active-projects')
  async getActiveProjects() {
    try {
      return await this.dashboardService.getActiveProjects();
    } catch (error) {
      console.error('Active projects error:', error);
      throw new HttpException(
        'Error al obtener proyectos activos',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}