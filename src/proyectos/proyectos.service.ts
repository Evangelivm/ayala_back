import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateProyectoDto, UpdateProyectoDto } from '../dto/proyectos.dto';

@Injectable()
export class ProyectosService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const proyectos = await this.prisma.proyecto.findMany({
      where: { estado: 'activo' },
      include: {
        etapas: {
          include: {
            sector: {
              include: {
                frente: {
                  include: {
                    partida: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return proyectos.map(proyecto => ({
      id: proyecto.id_proyecto,
      nombre: proyecto.nombre,
      descripcion: proyecto.descripcion,
      cliente: proyecto.cliente,
      ubicacion: proyecto.ubicacion,
      fecha_inicio: proyecto.fecha_inicio?.toISOString().split('T')[0],
      fecha_fin: proyecto.fecha_fin?.toISOString().split('T')[0],
      estado: proyecto.estado,
      activo: proyecto.estado === 'activo',
      etapas: proyecto.etapas.map(etapa => ({
        id: etapa.id_etapa,
        nombre: etapa.nombre,
        descripcion: etapa.descripcion,
        sectores: etapa.sector.map(sector => ({
          id: sector.id_sector,
          nombre: sector.nombre,
          descripcion: sector.descripcion,
          ubicacion: sector.ubicacion,
          frentes: sector.frente.map(frente => ({
            id: frente.id_frente,
            nombre: frente.nombre,
            descripcion: frente.descripcion,
            responsable: frente.responsable,
            partidas: frente.partida.map(partida => ({
              id: partida.id_partida,
              codigo: partida.codigo,
              descripcion: partida.descripcion,
              unidad_medida: partida.unidad_medida,
              cantidad: Number(partida.cantidad),
              precio_unitario: partida.precio_unitario ? Number(partida.precio_unitario) : null,
              total: partida.total ? Number(partida.total) : null,
            })),
          })),
        })),
      })),
      created_at: proyecto.created_at?.toISOString(),
      updated_at: proyecto.updated_at?.toISOString(),
    }));
  }

  async findOne(id: number) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id_proyecto: id },
      include: {
        etapas: {
          include: {
            sector: {
              include: {
                frente: {
                  include: {
                    partida: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!proyecto) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    return {
      id: proyecto.id_proyecto,
      nombre: proyecto.nombre,
      descripcion: proyecto.descripcion,
      cliente: proyecto.cliente,
      ubicacion: proyecto.ubicacion,
      fecha_inicio: proyecto.fecha_inicio?.toISOString().split('T')[0],
      fecha_fin: proyecto.fecha_fin?.toISOString().split('T')[0],
      estado: proyecto.estado,
      activo: proyecto.estado === 'activo',
      etapas: proyecto.etapas.map(etapa => ({
        id: etapa.id_etapa,
        nombre: etapa.nombre,
        descripcion: etapa.descripcion,
        sectores: etapa.sector.map(sector => ({
          id: sector.id_sector,
          nombre: sector.nombre,
          descripcion: sector.descripcion,
          ubicacion: sector.ubicacion,
          frentes: sector.frente.map(frente => ({
            id: frente.id_frente,
            nombre: frente.nombre,
            descripcion: frente.descripcion,
            responsable: frente.responsable,
            partidas: frente.partida.map(partida => ({
              id: partida.id_partida,
              codigo: partida.codigo,
              descripcion: partida.descripcion,
              unidad_medida: partida.unidad_medida,
              cantidad: Number(partida.cantidad),
              precio_unitario: partida.precio_unitario ? Number(partida.precio_unitario) : null,
              total: partida.total ? Number(partida.total) : null,
            })),
          })),
        })),
      })),
      created_at: proyecto.created_at?.toISOString(),
      updated_at: proyecto.updated_at?.toISOString(),
    };
  }

  async findByNombre(nombre: string) {
    const proyecto = await this.prisma.proyecto.findFirst({
      where: { 
        nombre: {
          contains: nombre,
        },
        estado: 'activo',
      },
      include: {
        etapas: {
          include: {
            sector: {
              include: {
                frente: true,
              },
            },
          },
        },
      },
    });

    if (!proyecto) return null;

    return {
      id: proyecto.id_proyecto,
      nombre: proyecto.nombre,
      descripcion: proyecto.descripcion,
      cliente: proyecto.cliente,
      ubicacion: proyecto.ubicacion,
      fecha_inicio: proyecto.fecha_inicio?.toISOString().split('T')[0],
      fecha_fin: proyecto.fecha_fin?.toISOString().split('T')[0],
      estado: proyecto.estado,
      activo: proyecto.estado === 'activo',
      etapas: proyecto.etapas.map(etapa => ({
        id: etapa.id_etapa,
        nombre: etapa.nombre,
        descripcion: etapa.descripcion,
        sectores: etapa.sector.map(sector => ({
          id: sector.id_sector,
          nombre: sector.nombre,
          descripcion: sector.descripcion,
          ubicacion: sector.ubicacion,
          frentes: sector.frente.map(frente => ({
            id: frente.id_frente,
            nombre: frente.nombre,
            descripcion: frente.descripcion,
            responsable: frente.responsable,
          })),
        })),
      })),
    };
  }

  async create(data: CreateProyectoDto) {
    // Validar que no exista un proyecto con el mismo nombre
    const existingProject = await this.prisma.proyecto.findFirst({
      where: { nombre: data.nombre },
    });

    if (existingProject) {
      throw new ConflictException('Ya existe un proyecto con este nombre');
    }

    const proyecto = await this.prisma.proyecto.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion || '',
        cliente: data.cliente || '',
        ubicacion: data.ubicacion || '',
        fecha_inicio: data.fecha_inicio ? new Date(data.fecha_inicio) : null,
        fecha_fin: data.fecha_fin ? new Date(data.fecha_fin) : null,
        estado: data.activo ? 'activo' : 'inactivo',
      },
      include: {
        etapas: true,
      },
    });

    return {
      id: proyecto.id_proyecto,
      nombre: proyecto.nombre,
      descripcion: proyecto.descripcion,
      cliente: proyecto.cliente,
      ubicacion: proyecto.ubicacion,
      fecha_inicio: proyecto.fecha_inicio?.toISOString().split('T')[0],
      fecha_fin: proyecto.fecha_fin?.toISOString().split('T')[0],
      estado: proyecto.estado,
      activo: proyecto.estado === 'activo',
      etapas: [],
      created_at: proyecto.created_at?.toISOString(),
      updated_at: proyecto.updated_at?.toISOString(),
    };
  }

  async update(id: number, data: UpdateProyectoDto) {
    // Verificar que el proyecto existe
    const existingProject = await this.prisma.proyecto.findUnique({
      where: { id_proyecto: id },
    });

    if (!existingProject) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    // Validar nombre único si se está actualizando
    if (data.nombre && data.nombre !== existingProject.nombre) {
      const duplicateProject = await this.prisma.proyecto.findFirst({
        where: { nombre: data.nombre },
      });
      if (duplicateProject) {
        throw new ConflictException('Ya existe un proyecto con este nombre');
      }
    }

    const proyecto = await this.prisma.proyecto.update({
      where: { id_proyecto: id },
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
        cliente: data.cliente,
        ubicacion: data.ubicacion,
        fecha_inicio: data.fecha_inicio ? new Date(data.fecha_inicio) : undefined,
        fecha_fin: data.fecha_fin ? new Date(data.fecha_fin) : undefined,
        estado: data.activo !== undefined ? (data.activo ? 'activo' : 'inactivo') : undefined,
        updated_at: new Date(),
      },
      include: {
        etapas: {
          include: {
            sector: {
              include: {
                frente: true,
              },
            },
          },
        },
      },
    });

    return {
      id: proyecto.id_proyecto,
      nombre: proyecto.nombre,
      descripcion: proyecto.descripcion,
      cliente: proyecto.cliente,
      ubicacion: proyecto.ubicacion,
      fecha_inicio: proyecto.fecha_inicio?.toISOString().split('T')[0],
      fecha_fin: proyecto.fecha_fin?.toISOString().split('T')[0],
      estado: proyecto.estado,
      activo: proyecto.estado === 'activo',
      etapas: proyecto.etapas.map(etapa => ({
        id: etapa.id_etapa,
        nombre: etapa.nombre,
        descripcion: etapa.descripcion,
        sectores: etapa.sector.map(sector => ({
          id: sector.id_sector,
          nombre: sector.nombre,
          descripcion: sector.descripcion,
          ubicacion: sector.ubicacion,
          frentes: sector.frente.map(frente => ({
            id: frente.id_frente,
            nombre: frente.nombre,
            descripcion: frente.descripcion,
            responsable: frente.responsable,
          })),
        })),
      })),
      created_at: proyecto.created_at?.toISOString(),
      updated_at: proyecto.updated_at?.toISOString(),
    };
  }

  async remove(id: number) {
    const existingProject = await this.prisma.proyecto.findUnique({
      where: { id_proyecto: id },
    });

    if (!existingProject) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    // Soft delete - marcar como inactivo
    await this.prisma.proyecto.update({
      where: { id_proyecto: id },
      data: {
        estado: 'inactivo',
        updated_at: new Date(),
      },
    });

    return { message: 'Proyecto marcado como inactivo' };
  }

  async hardDelete(id: number) {
    const existingProject = await this.prisma.proyecto.findUnique({
      where: { id_proyecto: id },
    });

    if (!existingProject) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    // Hard delete - eliminar completamente
    await this.prisma.proyecto.delete({
      where: { id_proyecto: id },
    });

    return { message: 'Proyecto eliminado permanentemente' };
  }
}