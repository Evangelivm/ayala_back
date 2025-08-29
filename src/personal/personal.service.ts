import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePersonalDto, UpdatePersonalDto, PersonalFilterDto } from '../dto/personal.dto';

@Injectable()
export class PersonalService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: PersonalFilterDto) {
    const where: any = {};
    
    if (filters?.activo !== undefined) {
      where.activo = filters.activo;
    } else {
      where.activo = true; // Por defecto solo mostrar activos
    }
    
    if (filters?.nombres) {
      where.nombres = { contains: filters.nombres };
    }
    
    if (filters?.apellidos) {
      where.apellidos = { contains: filters.apellidos };
    }
    
    if (filters?.dni) {
      where.dni = { contains: filters.dni };
    }
    
    if (filters?.fecha_ingreso_desde && filters?.fecha_ingreso_hasta) {
      where.fecha_ingreso = {
        gte: new Date(filters.fecha_ingreso_desde),
        lte: new Date(filters.fecha_ingreso_hasta),
      };
    }

    const skip = filters?.page ? (filters.page - 1) * (filters.limit || 10) : 0;
    const take = filters?.limit || 10;

    const [personal, total] = await Promise.all([
      this.prisma.personal.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      this.prisma.personal.count({ where }),
    ]);

    const data = personal.map(p => ({
      ...p,
      fecha_ingreso: p.fecha_ingreso.toISOString().split('T')[0],
      created_at: p.created_at?.toISOString() || null,
      updated_at: p.updated_at?.toISOString() || null,
      nombre_completo: `${p.nombres} ${p.apellidos}`,
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

  async findByCargo(cargo?: string) {
    // Como ya no hay campo cargo, devolvemos todo el personal activo usando findAll
    // para mantener consistencia en el formato de respuesta
    return this.findAll({ activo: true, page: 1, limit: 100 });
  }

  async findOne(id: number) {
    const personal = await this.prisma.personal.findUnique({
      where: { id_personal: id },
    });

    if (!personal) return null;

    return {
      ...personal,
      fecha_ingreso: personal.fecha_ingreso.toISOString().split('T')[0],
      created_at: personal.created_at?.toISOString() || null,
      updated_at: personal.updated_at?.toISOString() || null,
      nombre_completo: `${personal.nombres} ${personal.apellidos}`,
    };
  }

  async create(data: CreatePersonalDto) {
    const personal = await this.prisma.personal.create({
      data: {
        nombres: data.nombres,
        apellidos: data.apellidos,
        dni: data.dni,
        telefono: data.telefono,
        correo: data.correo,
        fecha_ingreso: new Date(data.fecha_ingreso),
        activo: data.activo,
        observaciones: data.observaciones,
      },
    });

    return {
      ...personal,
      fecha_ingreso: personal.fecha_ingreso.toISOString().split('T')[0],
      created_at: personal.created_at?.toISOString() || null,
      updated_at: personal.updated_at?.toISOString() || null,
      nombre_completo: `${personal.nombres} ${personal.apellidos}`,
    };
  }

  async update(id: number, data: UpdatePersonalDto) {
    const personal = await this.prisma.personal.update({
      where: { id_personal: id },
      data: {
        nombres: data.nombres,
        apellidos: data.apellidos,
        dni: data.dni,
        telefono: data.telefono,
        correo: data.correo,
        fecha_ingreso: data.fecha_ingreso ? new Date(data.fecha_ingreso) : undefined,
        activo: data.activo,
        observaciones: data.observaciones,
        updated_at: new Date(),
      },
    });

    return {
      ...personal,
      fecha_ingreso: personal.fecha_ingreso.toISOString().split('T')[0],
      created_at: personal.created_at?.toISOString() || null,
      updated_at: personal.updated_at?.toISOString() || null,
      nombre_completo: `${personal.nombres} ${personal.apellidos}`,
    };
  }

  async remove(id: number) {
    await this.prisma.personal.update({
      where: { id_personal: id },
      data: { 
        activo: false,
        updated_at: new Date(),
      },
    });

    return { message: 'Personal marcado como inactivo' };
  }

  async hardDelete(id: number) {
    await this.prisma.personal.delete({
      where: { id_personal: id },
    });

    return { message: 'Personal eliminado permanentemente' };
  }
}