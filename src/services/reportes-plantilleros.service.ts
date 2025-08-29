import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ReportesPlantillerosDto,
  UpdateReportesPlantillerosDto,
  ReportesPlantillerosFilterDto,
  ReportesPlantillerosResponse,
} from '../dto/reportes-plantilleros.dto';

@Injectable()
export class ReportesPlantillerosService {
  constructor(private prisma: PrismaService) {}

  async create(data: ReportesPlantillerosDto): Promise<ReportesPlantillerosResponse> {
    // Validar que no exista un código de reporte duplicado
    const existingReport = await this.prisma.reportes_plantilleros.findUnique({
      where: { codigo_reporte: data.codigo_reporte },
    });

    if (existingReport) {
      throw new ConflictException('Ya existe un reporte con este código');
    }

    // Validar que el proyecto existe si se proporciona
    if (data.id_proyecto) {
      const proyecto = await this.prisma.proyecto.findUnique({
        where: { id_proyecto: data.id_proyecto },
      });
      if (!proyecto) {
        throw new NotFoundException('Proyecto no encontrado');
      }
    }

    // Crear el reporte
    const reporte = await this.prisma.reportes_plantilleros.create({
      data: {
        codigo_reporte: data.codigo_reporte,
        id_proyecto: data.id_proyecto,
        fecha: new Date(data.fecha),
        comentarios: data.comentarios,
        // Campos con IDs
        id_personal: data.id_personal,
        id_etapa: data.id_etapa,
        id_frente: data.id_frente,
        id_maquinaria: data.id_maquinaria,
        // Campos de texto
        cargo: data.cargo,
        sector: data.sector,
        hora_inicio: data.hora_inicio,
        hora_fin: data.hora_fin,
        material: data.material,
        partida: data.partida,
      },
    });

    // Retornar el resultado completo con todas las relaciones
    return this.findOne(reporte.id_reporte);
  }

  async findAll(filters: ReportesPlantillerosFilterDto) {
    const where: any = {};

    if (filters.fecha_desde && filters.fecha_hasta) {
      where.fecha = {
        gte: new Date(filters.fecha_desde),
        lte: new Date(filters.fecha_hasta),
      };
    }

    if (filters.id_proyecto) {
      where.id_proyecto = filters.id_proyecto;
    }

    if (filters.codigo_reporte) {
      where.codigo_reporte = {
        contains: filters.codigo_reporte,
      };
    }

    if (filters.responsable) {
      where.responsable = {
        contains: filters.responsable,
      };
    }

    if (filters.activo !== undefined) {
      where.activo = filters.activo;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [data, total] = await Promise.all([
      this.prisma.reportes_plantilleros.findMany({
        where,
        include: {
          proyecto: {
            select: {
              id_proyecto: true,
              nombre: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: filters.limit,
      }),
      this.prisma.reportes_plantilleros.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async findOne(id: number): Promise<ReportesPlantillerosResponse> {
    const reporte = await this.prisma.reportes_plantilleros.findUnique({
      where: { id_reporte: id },
      include: {
        proyecto: {
          select: {
            id_proyecto: true,
            nombre: true,
          },
        },
      },
    });

    if (!reporte) {
      throw new NotFoundException('Reporte de plantilleros no encontrado');
    }

    return {
      ...reporte,
      fecha: reporte.fecha.toISOString().split('T')[0],
      created_at: reporte.created_at?.toISOString() || '',
      updated_at: reporte.updated_at?.toISOString() || '',
    } as ReportesPlantillerosResponse;
  }

  async update(id: number, data: UpdateReportesPlantillerosDto): Promise<ReportesPlantillerosResponse> {
    // Verificar que el reporte existe
    const existingReporte = await this.prisma.reportes_plantilleros.findUnique({
      where: { id_reporte: id },
    });

    if (!existingReporte) {
      throw new NotFoundException('Reporte de plantilleros no encontrado');
    }

    // Validar código de reporte único si se está actualizando
    if (data.codigo_reporte && data.codigo_reporte !== existingReporte.codigo_reporte) {
      const duplicateReport = await this.prisma.reportes_plantilleros.findUnique({
        where: { codigo_reporte: data.codigo_reporte },
      });
      if (duplicateReport) {
        throw new ConflictException('Ya existe un reporte con este código');
      }
    }

    // Validar proyecto si se proporciona
    if (data.id_proyecto) {
      const proyecto = await this.prisma.proyecto.findUnique({
        where: { id_proyecto: data.id_proyecto },
      });
      if (!proyecto) {
        throw new NotFoundException('Proyecto no encontrado');
      }
    }

    // Actualizar el reporte
    const reporte = await this.prisma.reportes_plantilleros.update({
      where: { id_reporte: id },
      data: {
        codigo_reporte: data.codigo_reporte,
        id_proyecto: data.id_proyecto,
        fecha: data.fecha ? new Date(data.fecha) : undefined,
        comentarios: data.comentarios,
        // Campos con IDs
        id_personal: data.id_personal,
        id_etapa: data.id_etapa,
        id_frente: data.id_frente,
        id_maquinaria: data.id_maquinaria,
        // Campos de texto
        cargo: data.cargo,
        sector: data.sector,
        hora_inicio: data.hora_inicio,
        hora_fin: data.hora_fin,
        material: data.material,
        partida: data.partida,
        updated_at: new Date(),
      },
    });

    return this.findOne(reporte.id_reporte);
  }

  async remove(id: number): Promise<{ message: string }> {
    const existingReporte = await this.prisma.reportes_plantilleros.findUnique({
      where: { id_reporte: id },
    });

    if (!existingReporte) {
      throw new NotFoundException('Reporte de plantilleros no encontrado');
    }

    // Soft delete - marcar como inactivo
    await this.prisma.reportes_plantilleros.update({
      where: { id_reporte: id },
      data: {
        activo: false,
        updated_at: new Date(),
      },
    });

    return { message: 'Reporte de plantilleros eliminado correctamente' };
  }

  async hardDelete(id: number): Promise<{ message: string }> {
    const existingReporte = await this.prisma.reportes_plantilleros.findUnique({
      where: { id_reporte: id },
    });

    if (!existingReporte) {
      throw new NotFoundException('Reporte de plantilleros no encontrado');
    }

    // Hard delete - eliminar completamente
    await this.prisma.reportes_plantilleros.delete({
      where: { id_reporte: id },
    });

    return { message: 'Reporte de plantilleros eliminado permanentemente' };
  }
}