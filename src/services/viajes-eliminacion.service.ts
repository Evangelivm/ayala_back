import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ViajesEliminacionDto,
  UpdateViajesEliminacionDto,
  ViajesEliminacionFilterDto,
  ViajesEliminacionResponse,
} from '../dto/viajes-eliminacion.dto';

@Injectable()
export class ViajesEliminacionService {
  constructor(private prisma: PrismaService) {}

  async create(data: ViajesEliminacionDto): Promise<ViajesEliminacionResponse> {
    // Validar que no exista un código de reporte duplicado
    const existingReport = await this.prisma.viajes_eliminacion.findUnique({
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
      const viaje = await tx.viajes_eliminacion.create({
        data: {
          codigo_reporte: data.codigo_reporte,
          id_proyecto: data.id_proyecto,
          fecha: new Date(data.fecha),
          id_responsable: data.id_responsable,
          id_operador: data.id_operador,
          maquinaria_pesada: data.maquinaria_pesada,
          id_vigia: data.id_vigia,
          id_mantero: data.id_mantero,
          id_controlador: data.id_controlador,
          id_capataz: data.id_capataz,
          comentarios: data.comentarios,
        },
      });

      // 2. Crear los detalles de viajes en loop
      for (const detalle of data.detalle_viajes) {
        const detalleCreated = await tx.detalle_viajes.create({
          data: {
            id_viaje: viaje.id_viaje,
            item: detalle.item,
            conductor: detalle.conductor,
            placa: detalle.placa,
            viajes: detalle.viajes,
            m3_tolva: detalle.m3_tolva,
          },
        });

        // 3. Crear los horarios para cada detalle en loop
        for (const horario of detalle.horarios) {
          await tx.detalle_horarios.create({
            data: {
              id_detalle_viaje: detalleCreated.id_detalle,
              numero_entrada: horario.numero_entrada,
              hora_inicio: horario.hora_inicio,
              hora_salida: horario.hora_salida,
            },
          });
        }
      }

      return viaje;
    });

    // Retornar el resultado completo con todas las relaciones
    return this.findOne(result.id_viaje);
  }

  async findAll(filters: ViajesEliminacionFilterDto) {
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

    if (filters.activo !== undefined) {
      where.activo = filters.activo;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [data, total] = await Promise.all([
      this.prisma.viajes_eliminacion.findMany({
        where,
        include: {
          proyecto: {
            select: {
              id_proyecto: true,
              nombre: true,
            },
          },
          responsable: {
            select: {
              id_personal: true,
              nombres: true,
              apellidos: true,
            },
          },
          operador: {
            select: {
              id_personal: true,
              nombres: true,
              apellidos: true,
            },
          },
          vigia: {
            select: {
              id_personal: true,
              nombres: true,
              apellidos: true,
            },
          },
          mantero: {
            select: {
              id_personal: true,
              nombres: true,
              apellidos: true,
            },
          },
          controlador: {
            select: {
              id_personal: true,
              nombres: true,
              apellidos: true,
            },
          },
          capataz: {
            select: {
              id_personal: true,
              nombres: true,
              apellidos: true,
            },
          },
          detalle_viajes: {
            include: {
              detalle_horarios: {
                orderBy: { numero_entrada: 'asc' },
              },
            },
            orderBy: { item: 'asc' },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: filters.limit,
      }),
      this.prisma.viajes_eliminacion.count({ where }),
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

  async findOne(id: number): Promise<ViajesEliminacionResponse> {
    const viaje = await this.prisma.viajes_eliminacion.findUnique({
      where: { id_viaje: id },
      include: {
        proyecto: {
          select: {
            id_proyecto: true,
            nombre: true,
          },
        },
        responsable: {
          select: {
            id_personal: true,
            nombres: true,
            apellidos: true,
          },
        },
        operador: {
          select: {
            id_personal: true,
            nombres: true,
            apellidos: true,
          },
        },
        vigia: {
          select: {
            id_personal: true,
            nombres: true,
            apellidos: true,
          },
        },
        mantero: {
          select: {
            id_personal: true,
            nombres: true,
            apellidos: true,
          },
        },
        controlador: {
          select: {
            id_personal: true,
            nombres: true,
            apellidos: true,
          },
        },
        capataz: {
          select: {
            id_personal: true,
            nombres: true,
            apellidos: true,
          },
        },
        detalle_viajes: {
          include: {
            detalle_horarios: {
              orderBy: { numero_entrada: 'asc' },
            },
          },
          orderBy: { item: 'asc' },
        },
      },
    });

    if (!viaje) {
      throw new NotFoundException('Reporte de viajes no encontrado');
    }

    return {
      ...viaje,
      fecha: viaje.fecha.toISOString().split('T')[0],
      created_at: viaje.created_at?.toISOString() || '',
      updated_at: viaje.updated_at?.toISOString() || '',
      nombre_responsable: viaje.responsable ? `${viaje.responsable.nombres} ${viaje.responsable.apellidos}` : null,
      operador: viaje.operador ? `${viaje.operador.nombres} ${viaje.operador.apellidos}` : null,
      vigia: viaje.vigia ? `${viaje.vigia.nombres} ${viaje.vigia.apellidos}` : null,
      mantero: viaje.mantero ? `${viaje.mantero.nombres} ${viaje.mantero.apellidos}` : null,
      controlador: viaje.controlador ? `${viaje.controlador.nombres} ${viaje.controlador.apellidos}` : null,
      capataz: viaje.capataz ? `${viaje.capataz.nombres} ${viaje.capataz.apellidos}` : null,
      detalle_viajes: viaje.detalle_viajes.map(detalle => ({
        ...detalle,
        m3_tolva: detalle.m3_tolva ? Number(detalle.m3_tolva) : null,
        created_at: undefined,
        detalle_horarios: detalle.detalle_horarios.map(horario => ({
          ...horario,
          created_at: undefined,
        })),
      })),
    } as ViajesEliminacionResponse;
  }

  async update(id: number, data: UpdateViajesEliminacionDto): Promise<ViajesEliminacionResponse> {
    // Verificar que el reporte existe
    const existingViaje = await this.prisma.viajes_eliminacion.findUnique({
      where: { id_viaje: id },
    });

    if (!existingViaje) {
      throw new NotFoundException('Reporte de viajes no encontrado');
    }

    // Validar código de reporte único si se está actualizando
    if (data.codigo_reporte && data.codigo_reporte !== existingViaje.codigo_reporte) {
      const duplicateReport = await this.prisma.viajes_eliminacion.findUnique({
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
      const viaje = await tx.viajes_eliminacion.update({
        where: { id_viaje: id },
        data: {
          codigo_reporte: data.codigo_reporte,
          id_proyecto: data.id_proyecto,
          fecha: data.fecha ? new Date(data.fecha) : undefined,
          id_responsable: data.id_responsable,
          id_operador: data.id_operador,
          maquinaria_pesada: data.maquinaria_pesada,
          id_vigia: data.id_vigia,
          id_mantero: data.id_mantero,
          id_controlador: data.id_controlador,
          id_capataz: data.id_capataz,
          comentarios: data.comentarios,
          updated_at: new Date(),
        },
      });

      // 2. Si se proporcionan nuevos detalles, eliminar los existentes y crear nuevos
      if (data.detalle_viajes && data.detalle_viajes.length > 0) {
        // Eliminar detalles existentes (cascada eliminará los horarios)
        await tx.detalle_viajes.deleteMany({
          where: { id_viaje: id },
        });

        // Crear nuevos detalles
        for (const detalle of data.detalle_viajes) {
          const detalleCreated = await tx.detalle_viajes.create({
            data: {
              id_viaje: viaje.id_viaje,
              item: detalle.item,
              conductor: detalle.conductor,
              placa: detalle.placa,
              viajes: detalle.viajes,
              m3_tolva: detalle.m3_tolva,
            },
          });

          // Crear horarios para cada detalle
          for (const horario of detalle.horarios) {
            await tx.detalle_horarios.create({
              data: {
                id_detalle_viaje: detalleCreated.id_detalle,
                numero_entrada: horario.numero_entrada,
                hora_inicio: horario.hora_inicio,
                hora_salida: horario.hora_salida,
              },
            });
          }
        }
      }

      return viaje;
    });

    return this.findOne(result.id_viaje);
  }

  async remove(id: number): Promise<{ message: string }> {
    const existingViaje = await this.prisma.viajes_eliminacion.findUnique({
      where: { id_viaje: id },
    });

    if (!existingViaje) {
      throw new NotFoundException('Reporte de viajes no encontrado');
    }

    // Soft delete - marcar como inactivo
    await this.prisma.viajes_eliminacion.update({
      where: { id_viaje: id },
      data: {
        activo: false,
        updated_at: new Date(),
      },
    });

    return { message: 'Reporte de viajes eliminado correctamente' };
  }

  async hardDelete(id: number): Promise<{ message: string }> {
    const existingViaje = await this.prisma.viajes_eliminacion.findUnique({
      where: { id_viaje: id },
    });

    if (!existingViaje) {
      throw new NotFoundException('Reporte de viajes no encontrado');
    }

    // Hard delete - eliminar completamente (cascada eliminará detalles y horarios)
    await this.prisma.viajes_eliminacion.delete({
      where: { id_viaje: id },
    });

    return { message: 'Reporte de viajes eliminado permanentemente' };
  }
}