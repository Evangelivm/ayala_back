import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEquipoDto, UpdateEquipoDto, EquipoFilterDto } from '../dto/equipos.dto';

@Injectable()
export class EquiposService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: EquipoFilterDto) {
    const where: any = {};
    
    if (filters?.activo !== undefined) {
      where.activo = filters.activo;
    } else {
      where.activo = true; // Por defecto solo mostrar activos
    }
    
    if (filters?.tipo_equipo) {
      where.tipo_equipo = filters.tipo_equipo;
    }
    
    if (filters?.marca) {
      where.marca = { contains: filters.marca };
    }
    
    if (filters?.modelo) {
      where.modelo = { contains: filters.modelo };
    }
    
    if (filters?.unidad) {
      where.unidad = { contains: filters.unidad };
    }

    const skip = filters?.page ? (filters.page - 1) * (filters.limit || 10) : 0;
    const take = filters?.limit || 10;

    const [equipos, total] = await Promise.all([
      this.prisma.equipos.findMany({
        where,
        orderBy: [
          { tipo_equipo: 'asc' },
          { marca: 'asc' },
          { modelo: 'asc' }
        ],
        skip,
        take,
      }),
      this.prisma.equipos.count({ where }),
    ]);

    const data = equipos.map(e => ({
      ...e,
      precio_referencial: Number(e.precio_referencial),
      created_at: e.created_at?.toISOString() || null,
      updated_at: e.updated_at?.toISOString() || null,
      nombre_completo: `${e.marca} ${e.modelo}`,
    }));

    return {
      data,
      pagination: {
        page: filters?.page || 1,
        limit: filters?.limit || 10,
        total,
        totalPages: Math.ceil(total / (filters?.limit || 10)),
      },
    };
  }

  async findByTipo(tipo_equipo: string) {
    const equipos = await this.prisma.equipos.findMany({
      where: {
        tipo_equipo: tipo_equipo as any,
        activo: true,
      },
      orderBy: [
        { marca: 'asc' },
        { modelo: 'asc' }
      ],
    });

    return equipos.map(e => ({
      id: e.id_equipo,
      tipo_equipo: e.tipo_equipo,
      marca: e.marca,
      modelo: e.modelo,
      descripcion: e.descripcion,
      unidad: e.unidad,
      precio_referencial: Number(e.precio_referencial),
      activo: e.activo,
      nombre_completo: `${e.marca} ${e.modelo}`,
    }));
  }

  async findOne(id: number) {
    const equipo = await this.prisma.equipos.findUnique({
      where: { id_equipo: id },
    });

    if (!equipo) return null;

    return {
      ...equipo,
      precio_referencial: Number(equipo.precio_referencial),
      created_at: equipo.created_at?.toISOString() || null,
      updated_at: equipo.updated_at?.toISOString() || null,
      nombre_completo: `${equipo.marca} ${equipo.modelo}`,
    };
  }

  async create(data: CreateEquipoDto) {
    const equipo = await this.prisma.equipos.create({
      data: {
        tipo_equipo: data.tipo_equipo as any,
        marca: data.marca,
        modelo: data.modelo,
        descripcion: data.descripcion,
        unidad: data.unidad,
        precio_referencial: data.precio_referencial,
        activo: data.activo,
      },
    });

    return {
      ...equipo,
      precio_referencial: Number(equipo.precio_referencial),
      created_at: equipo.created_at?.toISOString() || null,
      updated_at: equipo.updated_at?.toISOString() || null,
      nombre_completo: `${equipo.marca} ${equipo.modelo}`,
    };
  }

  async update(id: number, data: UpdateEquipoDto) {
    const equipo = await this.prisma.equipos.update({
      where: { id_equipo: id },
      data: {
        tipo_equipo: data.tipo_equipo as any,
        marca: data.marca,
        modelo: data.modelo,
        descripcion: data.descripcion,
        unidad: data.unidad,
        precio_referencial: data.precio_referencial,
        activo: data.activo,
        updated_at: new Date(),
      },
    });

    return {
      ...equipo,
      precio_referencial: Number(equipo.precio_referencial),
      created_at: equipo.created_at?.toISOString() || null,
      updated_at: equipo.updated_at?.toISOString() || null,
      nombre_completo: `${equipo.marca} ${equipo.modelo}`,
    };
  }

  async remove(id: number) {
    await this.prisma.equipos.update({
      where: { id_equipo: id },
      data: { 
        activo: false,
        updated_at: new Date(),
      },
    });

    return { message: 'Equipo marcado como inactivo' };
  }

  async hardDelete(id: number) {
    await this.prisma.equipos.delete({
      where: { id_equipo: id },
    });

    return { message: 'Equipo eliminado permanentemente' };
  }
}