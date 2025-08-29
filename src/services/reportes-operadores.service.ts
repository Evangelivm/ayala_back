import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ReportesOperadoresDto,
  UpdateReportesOperadoresDto,
  ReportesOperadoresFilterDto,
  ReportesOperadoresResponse,
} from '../dto/reportes-operadores.dto';

@Injectable()
export class ReportesOperadoresService {
  constructor(private prisma: PrismaService) {}

  async create(data: ReportesOperadoresDto): Promise<ReportesOperadoresResponse> {
    // Validar que no exista un código de reporte duplicado
    const existingReport = await this.prisma.reportes_operadores.findUnique({
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

    // Usar transacción para crear el reporte maestro y sus detalles
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Crear el registro maestro
      const reporte = await tx.reportes_operadores.create({
        data: {
          codigo_reporte: data.codigo_reporte,
          id_proyecto: data.id_proyecto,
          fecha: new Date(data.fecha),
          id_operador: data.id_operador,
          id_maquinaria: data.id_maquinaria,
          id_vigia1: data.id_vigia1,
          id_vigia2: data.id_vigia2,
          id_vigia3: data.id_vigia3,
          id_etapa: data.id_etapa,
          id_equipo: data.id_equipo,
          horario1: data.horario1,
          horario2: data.horario2,
          horario3: data.horario3,
          horometro_inicial: data.horometro_inicial,
          horometro_final: data.horometro_final,
        },
      });

      // 2. Crear los detalles de producción en loop (solo si hay detalles)
      if (data.detalle_produccion && data.detalle_produccion.length > 0) {
        for (const detalle of data.detalle_produccion) {
          await tx.detalle_produccion.create({
            data: {
              id_reporte: reporte.id_reporte,
              item: detalle.item,
              sector: detalle.sector,
              frente: detalle.frente,
              descripcion: detalle.descripcion,
              material: detalle.material,
              m3: detalle.m3,
              viajes: detalle.viajes,
              horas_trabajadas: detalle.horas_trabajadas,
            },
          });
        }
      }

      return reporte;
    });

    // Retornar el resultado completo con todas las relaciones
    return this.findOne(result.id_reporte);
  }

  async findAll(filters: ReportesOperadoresFilterDto) {
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

    if (filters.operador) {
      where.operador = {
        contains: filters.operador,
      };
    }

    if (filters.activo !== undefined) {
      where.activo = filters.activo;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [data, total] = await Promise.all([
      this.prisma.reportes_operadores.findMany({
        where,
        include: {
          proyecto: {
            select: {
              id_proyecto: true,
              nombre: true,
            },
          },
          operador: {
            select: {
              id_personal: true,
              nombres: true,
              apellidos: true,
            },
          },
          vigia1: {
            select: {
              id_personal: true,
              nombres: true,
              apellidos: true,
            },
          },
          vigia2: {
            select: {
              id_personal: true,
              nombres: true,
              apellidos: true,
            },
          },
          vigia3: {
            select: {
              id_personal: true,
              nombres: true,
              apellidos: true,
            },
          },
          etapa: {
            select: {
              id_etapa: true,
              nombre: true,
            },
          },
          equipo: {
            select: {
              id_equipo: true,
              marca: true,
              modelo: true,
            },
          },
          maquinaria: {
            select: {
              id_maquinaria: true,
              marca: true,
              modelo: true,
              codigo: true,
            },
          },
          detalle_produccion: {
            orderBy: { item: 'asc' },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: filters.limit,
      }),
      this.prisma.reportes_operadores.count({ where }),
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

  async findOne(id: number): Promise<ReportesOperadoresResponse> {
    const reporte = await this.prisma.reportes_operadores.findUnique({
      where: { id_reporte: id },
      include: {
        proyecto: {
          select: {
            id_proyecto: true,
            nombre: true,
          },
        },
        operador: {
          select: {
            id_personal: true,
            nombres: true,
            apellidos: true,
          },
        },
        vigia1: {
          select: {
            id_personal: true,
            nombres: true,
            apellidos: true,
          },
        },
        vigia2: {
          select: {
            id_personal: true,
            nombres: true,
            apellidos: true,
          },
        },
        vigia3: {
          select: {
            id_personal: true,
            nombres: true,
            apellidos: true,
          },
        },
        etapa: {
          select: {
            id_etapa: true,
            nombre: true,
          },
        },
        equipo: {
          select: {
            id_equipo: true,
            marca: true,
            modelo: true,
          },
        },
        maquinaria: {
          select: {
            id_maquinaria: true,
            marca: true,
            modelo: true,
            codigo: true,
          },
        },
        detalle_produccion: {
          orderBy: { item: 'asc' },
        },
      },
    });

    if (!reporte) {
      throw new NotFoundException('Reporte de operadores no encontrado');
    }

    return {
      ...reporte,
      fecha: reporte.fecha.toISOString().split('T')[0],
      created_at: reporte.created_at?.toISOString() || '',
      updated_at: reporte.updated_at?.toISOString() || '',
      operador: reporte.operador ? `${reporte.operador.nombres} ${reporte.operador.apellidos}` : null,
      vigia1: reporte.vigia1 ? `${reporte.vigia1.nombres} ${reporte.vigia1.apellidos}` : null,
      vigia2: reporte.vigia2 ? `${reporte.vigia2.nombres} ${reporte.vigia2.apellidos}` : null,
      vigia3: reporte.vigia3 ? `${reporte.vigia3.nombres} ${reporte.vigia3.apellidos}` : null,
      etapa: reporte.etapa ? reporte.etapa.nombre : null,
      equipo: reporte.equipo ? `${reporte.equipo.marca} ${reporte.equipo.modelo}` : null,
      maquinaria: reporte.maquinaria ? `${reporte.maquinaria.marca} ${reporte.maquinaria.modelo}` : null,
      // Campo legacy para compatibilidad - usar vigia1 como principal
      vigia: reporte.vigia1 ? `${reporte.vigia1.nombres} ${reporte.vigia1.apellidos}` : null,
      detalle_produccion: reporte.detalle_produccion.map(detalle => ({
        ...detalle,
        m3: detalle.m3 ? Number(detalle.m3) : null,
        horas_trabajadas: detalle.horas_trabajadas ? Number(detalle.horas_trabajadas) : null,
        created_at: undefined,
      })),
    } as ReportesOperadoresResponse;
  }

  async update(id: number, data: UpdateReportesOperadoresDto): Promise<ReportesOperadoresResponse> {
    // Verificar que el reporte existe
    const existingReporte = await this.prisma.reportes_operadores.findUnique({
      where: { id_reporte: id },
    });

    if (!existingReporte) {
      throw new NotFoundException('Reporte de operadores no encontrado');
    }

    // Validar código de reporte único si se está actualizando
    if (data.codigo_reporte && data.codigo_reporte !== existingReporte.codigo_reporte) {
      const duplicateReport = await this.prisma.reportes_operadores.findUnique({
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

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Actualizar el registro maestro
      const reporte = await tx.reportes_operadores.update({
        where: { id_reporte: id },
        data: {
          codigo_reporte: data.codigo_reporte,
          id_proyecto: data.id_proyecto,
          fecha: data.fecha ? new Date(data.fecha) : undefined,
          id_operador: data.id_operador,
          id_maquinaria: data.id_maquinaria,
          id_vigia1: data.id_vigia1,
          id_vigia2: data.id_vigia2,
          id_vigia3: data.id_vigia3,
          id_etapa: data.id_etapa,
          id_equipo: data.id_equipo,
          horario1: data.horario1,
          horario2: data.horario2,
          horario3: data.horario3,
          horometro_inicial: data.horometro_inicial,
          horometro_final: data.horometro_final,
          updated_at: new Date(),
        },
      });

      // 2. Si se proporcionan nuevos detalles, eliminar los existentes y crear nuevos
      if (data.detalle_produccion && data.detalle_produccion.length > 0) {
        // Eliminar detalles existentes
        await tx.detalle_produccion.deleteMany({
          where: { id_reporte: id },
        });

        // Crear nuevos detalles
        for (const detalle of data.detalle_produccion) {
          await tx.detalle_produccion.create({
            data: {
              id_reporte: reporte.id_reporte,
              item: detalle.item,
              sector: detalle.sector,
              frente: detalle.frente,
              descripcion: detalle.descripcion,
              material: detalle.material,
              m3: detalle.m3,
              viajes: detalle.viajes,
              horas_trabajadas: detalle.horas_trabajadas,
            },
          });
        }
      }

      return reporte;
    });

    return this.findOne(result.id_reporte);
  }

  async remove(id: number): Promise<{ message: string }> {
    const existingReporte = await this.prisma.reportes_operadores.findUnique({
      where: { id_reporte: id },
    });

    if (!existingReporte) {
      throw new NotFoundException('Reporte de operadores no encontrado');
    }

    // Soft delete - marcar como inactivo
    await this.prisma.reportes_operadores.update({
      where: { id_reporte: id },
      data: {
        activo: false,
        updated_at: new Date(),
      },
    });

    return { message: 'Reporte de operadores eliminado correctamente' };
  }

  async hardDelete(id: number): Promise<{ message: string }> {
    const existingReporte = await this.prisma.reportes_operadores.findUnique({
      where: { id_reporte: id },
    });

    if (!existingReporte) {
      throw new NotFoundException('Reporte de operadores no encontrado');
    }

    // Hard delete - eliminar completamente (cascada eliminará detalles)
    await this.prisma.reportes_operadores.delete({
      where: { id_reporte: id },
    });

    return { message: 'Reporte de operadores eliminado permanentemente' };
  }
}