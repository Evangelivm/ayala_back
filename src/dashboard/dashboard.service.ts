import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DashboardStats {
  reportesViajes: {
    total: number;
    hoy: number;
    ultimaSemana: number;
    ultimoMes: number;
  };
  reportesPlantilleros: {
    total: number;
    hoy: number;
    ultimaSemana: number;
    ultimoMes: number;
  };
  reportesOperadores: {
    total: number;
    hoy: number;
    ultimaSemana: number;
    ultimoMes: number;
  };
  proyectosActivos: number;
  personalActivo: number;
  equiposDisponibles: number;
  totalHorasOperacion: number;
  totalViajes: number;
  totalM3: number;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    try {
      const ahora = new Date();
      const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      const ultimaSemana = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
      const ultimoMes = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Consultas en paralelo para optimizar performance
      const [
        viajesStats,
        plantillerosStats,
        operadoresStats,
        proyectosActivos,
        personalActivo,
        equiposDisponibles,
        totalViajes,
        totalM3,
        totalHoras,
      ] = await Promise.allSettled([
        this.getViajesStats(hoy, ultimaSemana, ultimoMes),
        this.getPlantillerosStats(hoy, ultimaSemana, ultimoMes),
        this.getOperadoresStats(hoy, ultimaSemana, ultimoMes),
        this.getProyectosActivos(),
        this.getPersonalActivo(),
        this.getEquiposDisponibles(),
        this.getTotalViajes(),
        this.getTotalM3(),
        this.getTotalHorasOperacion(),
      ]);

      return {
        reportesViajes: viajesStats.status === 'fulfilled' ? viajesStats.value : { total: 0, hoy: 0, ultimaSemana: 0, ultimoMes: 0 },
        reportesPlantilleros: plantillerosStats.status === 'fulfilled' ? plantillerosStats.value : { total: 0, hoy: 0, ultimaSemana: 0, ultimoMes: 0 },
        reportesOperadores: operadoresStats.status === 'fulfilled' ? operadoresStats.value : { total: 0, hoy: 0, ultimaSemana: 0, ultimoMes: 0 },
        proyectosActivos: proyectosActivos.status === 'fulfilled' ? proyectosActivos.value : 0,
        personalActivo: personalActivo.status === 'fulfilled' ? personalActivo.value : 0,
        equiposDisponibles: equiposDisponibles.status === 'fulfilled' ? equiposDisponibles.value : 0,
        totalViajes: totalViajes.status === 'fulfilled' ? totalViajes.value : 0,
        totalM3: totalM3.status === 'fulfilled' ? totalM3.value : 0,
        totalHorasOperacion: totalHoras.status === 'fulfilled' ? totalHoras.value : 0,
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  private async getViajesStats(hoy: Date, ultimaSemana: Date, ultimoMes: Date) {
    const [total, reportesHoy, reportesUltimaSemana, reportesUltimoMes] = await Promise.all([
      this.prisma.viajes_eliminacion.count({ where: { activo: true } }),
      this.prisma.viajes_eliminacion.count({
        where: {
          activo: true,
          fecha: {
            gte: hoy,
          },
        },
      }),
      this.prisma.viajes_eliminacion.count({
        where: {
          activo: true,
          fecha: {
            gte: ultimaSemana,
          },
        },
      }),
      this.prisma.viajes_eliminacion.count({
        where: {
          activo: true,
          fecha: {
            gte: ultimoMes,
          },
        },
      }),
    ]);

    return { total, hoy: reportesHoy, ultimaSemana: reportesUltimaSemana, ultimoMes: reportesUltimoMes };
  }

  private async getPlantillerosStats(hoy: Date, ultimaSemana: Date, ultimoMes: Date) {
    const [total, reportesHoy, reportesUltimaSemana, reportesUltimoMes] = await Promise.all([
      this.prisma.reportes_plantilleros.count({ where: { activo: true } }),
      this.prisma.reportes_plantilleros.count({
        where: {
          activo: true,
          fecha: {
            gte: hoy,
          },
        },
      }),
      this.prisma.reportes_plantilleros.count({
        where: {
          activo: true,
          fecha: {
            gte: ultimaSemana,
          },
        },
      }),
      this.prisma.reportes_plantilleros.count({
        where: {
          activo: true,
          fecha: {
            gte: ultimoMes,
          },
        },
      }),
    ]);

    return { total, hoy: reportesHoy, ultimaSemana: reportesUltimaSemana, ultimoMes: reportesUltimoMes };
  }

  private async getOperadoresStats(hoy: Date, ultimaSemana: Date, ultimoMes: Date) {
    const [total, reportesHoy, reportesUltimaSemana, reportesUltimoMes] = await Promise.all([
      this.prisma.reportes_operadores.count({ where: { activo: true } }),
      this.prisma.reportes_operadores.count({
        where: {
          activo: true,
          fecha: {
            gte: hoy,
          },
        },
      }),
      this.prisma.reportes_operadores.count({
        where: {
          activo: true,
          fecha: {
            gte: ultimaSemana,
          },
        },
      }),
      this.prisma.reportes_operadores.count({
        where: {
          activo: true,
          fecha: {
            gte: ultimoMes,
          },
        },
      }),
    ]);

    return { total, hoy: reportesHoy, ultimaSemana: reportesUltimaSemana, ultimoMes: reportesUltimoMes };
  }

  private async getProyectosActivos(): Promise<number> {
    return this.prisma.proyecto.count({
      where: { estado: 'activo' },
    });
  }

  private async getPersonalActivo(): Promise<number> {
    return this.prisma.personal.count({
      where: { activo: true },
    });
  }

  private async getEquiposDisponibles(): Promise<number> {
    return this.prisma.equipos.count({
      where: { activo: true },
    });
  }

  private async getTotalViajes(): Promise<number> {
    const result = await this.prisma.detalle_viajes.aggregate({
      _sum: {
        viajes: true,
      },
      where: {
        viajes_eliminacion: {
          activo: true,
        },
      },
    });

    return result._sum.viajes || 0;
  }

  private async getTotalM3(): Promise<number> {
    const result = await this.prisma.detalle_produccion.aggregate({
      _sum: {
        m3: true,
      },
      where: {
        reportes_operadores: {
          activo: true,
        },
      },
    });

    const m3Value = result._sum.m3?.toNumber() || 0;
    return Math.round(m3Value * 10) / 10;
  }

  private async getTotalHorasOperacion(): Promise<number> {
    const result = await this.prisma.detalle_produccion.aggregate({
      _sum: {
        horas_trabajadas: true,
      },
      where: {
        reportes_operadores: {
          activo: true,
        },
      },
    });

    const horasValue = result._sum.horas_trabajadas?.toNumber() || 0;
    return Math.round(horasValue * 10) / 10;
  }

  async getRecentReports(limit: number = 10) {
    try {
      // Obtener reportes recientes de todos los tipos
      const [viajesRecientes, plantillerosRecientes, operadoresRecientes] = await Promise.all([
        this.prisma.viajes_eliminacion.findMany({
          take: Math.ceil(limit / 3),
          orderBy: { created_at: 'desc' },
          where: { activo: true },
          select: {
            id_viaje: true,
            codigo_reporte: true,
            fecha: true,
            proyecto: {
              select: {
                nombre: true,
              },
            },
            responsable: {
              select: {
                nombres: true,
                apellidos: true,
              },
            },
          },
        }),
        this.prisma.reportes_plantilleros.findMany({
          take: Math.ceil(limit / 3),
          orderBy: { created_at: 'desc' },
          where: { activo: true },
          select: {
            id_reporte: true,
            codigo_reporte: true,
            fecha: true,
            proyecto: {
              select: {
                nombre: true,
              },
            },
          },
        }),
        this.prisma.reportes_operadores.findMany({
          take: Math.ceil(limit / 3),
          orderBy: { created_at: 'desc' },
          where: { activo: true },
          select: {
            id_reporte: true,
            codigo_reporte: true,
            fecha: true,
            proyecto: {
              select: {
                nombre: true,
              },
            },
            operador: {
              select: {
                nombres: true,
                apellidos: true,
              },
            },
          },
        }),
      ]);

      // Transformar y combinar reportes
      const reportesCombi = [
        ...viajesRecientes.map((r) => ({
          id: r.id_viaje,
          codigo: r.codigo_reporte,
          tipo: 'viajes' as const,
          fecha: r.fecha.toISOString(),
          proyecto: r.proyecto?.nombre,
          responsable: r.responsable ? `${r.responsable.nombres} ${r.responsable.apellidos}` : 'N/A',
        })),
        ...plantillerosRecientes.map((r) => ({
          id: r.id_reporte,
          codigo: r.codigo_reporte,
          tipo: 'plantilleros' as const,
          fecha: r.fecha.toISOString(),
          proyecto: r.proyecto?.nombre,
          responsable: 'N/A', // Will need to be adjusted based on actual schema
        })),
        ...operadoresRecientes.map((r) => ({
          id: r.id_reporte,
          codigo: r.codigo_reporte,
          tipo: 'operadores' as const,
          fecha: r.fecha.toISOString(),
          proyecto: r.proyecto?.nombre,
          responsable: r.operador ? `${r.operador.nombres} ${r.operador.apellidos}` : 'N/A',
        })),
      ];

      // Ordenar por fecha y limitar
      return reportesCombi
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent reports:', error);
      return [];
    }
  }

  async getActivityByPeriod(period: 'day' | 'week' | 'month' = 'week') {
    try {
      const ahora = new Date();
      let fechaInicio: Date;

      switch (period) {
        case 'day':
          fechaInicio = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'month':
          fechaInicio = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'week':
        default:
          fechaInicio = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
      }

      const [viajes, plantilleros, operadores] = await Promise.all([
        this.prisma.viajes_eliminacion.count({
          where: {
            activo: true,
            fecha: { gte: fechaInicio },
          },
        }),
        this.prisma.reportes_plantilleros.count({
          where: {
            activo: true,
            fecha: { gte: fechaInicio },
          },
        }),
        this.prisma.reportes_operadores.count({
          where: {
            activo: true,
            fecha: { gte: fechaInicio },
          },
        }),
      ]);

      return {
        period,
        fechaInicio: fechaInicio.toISOString(),
        fechaFin: ahora.toISOString(),
        data: {
          viajes,
          plantilleros,
          operadores,
          total: viajes + plantilleros + operadores,
        },
      };
    } catch (error) {
      console.error('Error getting activity by period:', error);
      return {
        period,
        data: { viajes: 0, plantilleros: 0, operadores: 0, total: 0 },
      };
    }
  }

  async getActiveProjects() {
    try {
      return await this.prisma.proyecto.findMany({
        where: { estado: 'activo' },
        select: {
          id_proyecto: true,
          nombre: true,
          cliente: true,
          ubicacion: true,
          created_at: true,
        },
        orderBy: { nombre: 'asc' },
      });
    } catch (error) {
      console.error('Error getting active projects:', error);
      return [];
    }
  }
}