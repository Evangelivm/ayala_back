import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCamionDto, UpdateCamionDto, CamionFilterDto } from '../dto/camiones.dto';

@Injectable()
export class CamionesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: CamionFilterDto) {
    const where: any = {};

    if (filters?.activo !== undefined) {
      where.activo = filters.activo;
    } else {
      where.activo = true; // Por defecto solo mostrar activos
    }

    if (filters?.placa) {
      where.placa = { contains: filters.placa };
    }

    if (filters?.marca) {
      where.marca = { contains: filters.marca };
    }

    if (filters?.modelo) {
      where.modelo = { contains: filters.modelo };
    }

    if (filters?.dni) {
      where.dni = { contains: filters.dni };
    }

    if (filters?.nombre_chofer) {
      where.nombre_chofer = { contains: filters.nombre_chofer };
    }

    const camiones = await this.prisma.camiones.findMany({
      where,
      orderBy: [
        { placa: 'asc' }
      ],
    });

    // Obtener códigos únicos de empresas de los camiones
    const empresaCodigos = [...new Set(camiones.map(c => c.empresa).filter(Boolean))] as string[];

    // Obtener datos de empresas si hay códigos
    const empresasMap = new Map<string, string | null>();
    if (empresaCodigos.length > 0) {
      const empresas = await this.prisma.empresas_2025.findMany({
        where: {
          codigo: { in: empresaCodigos }
        },
        select: {
          codigo: true,
          razon_social: true,
        }
      });
      empresas.forEach(e => empresasMap.set(e.codigo, e.razon_social));
    }

    const data = camiones.map(c => ({
      ...c,
      año: c.a_o || null,
      capacidad_tanque: c.capacidad_tanque ? Number(c.capacidad_tanque) : null,
      fecha_registro: c.fecha_registro?.toISOString() || null,
      razon_social_empresa: c.empresa ? (empresasMap.get(c.empresa) || null) : null,
    }));

    return data;
  }

  async findOne(id: number) {
    const camion = await this.prisma.camiones.findUnique({
      where: { id_camion: id },
    });

    if (!camion) return null;

    // Obtener datos de la empresa si existe
    let razon_social_empresa: string | null = null;
    if (camion.empresa) {
      const empresa = await this.prisma.empresas_2025.findUnique({
        where: { codigo: camion.empresa },
        select: { razon_social: true }
      });
      razon_social_empresa = empresa?.razon_social || null;
    }

    return {
      ...camion,
      año: camion.a_o || null,
      capacidad_tanque: camion.capacidad_tanque ? Number(camion.capacidad_tanque) : null,
      fecha_registro: camion.fecha_registro?.toISOString() || null,
      razon_social_empresa,
    };
  }

  async create(data: CreateCamionDto) {
    const camion = await this.prisma.camiones.create({
      data: {
        placa: data.placa,
        marca: data.marca || null,
        modelo: data.modelo || null,
        a_o: data.año || null,
        capacidad_tanque: data.capacidad_tanque || null,
        id_tipo_combustible_preferido: data.id_tipo_combustible_preferido || null,
        activo: data.activo ?? true,
        dni: data.dni || null,
        nombre_chofer: data.nombre_chofer || null,
        apellido_chofer: data.apellido_chofer || null,
        numero_licencia: data.numero_licencia || null,
      },
    });

    return {
      ...camion,
      año: camion.a_o || null,
      capacidad_tanque: camion.capacidad_tanque ? Number(camion.capacidad_tanque) : null,
      fecha_registro: camion.fecha_registro?.toISOString() || null,
    };
  }

  async update(id: number, data: UpdateCamionDto) {
    const updateData: any = {};

    if (data.placa !== undefined) updateData.placa = data.placa;
    if (data.marca !== undefined) updateData.marca = data.marca;
    if (data.modelo !== undefined) updateData.modelo = data.modelo;
    if (data.año !== undefined) updateData.a_o = data.año;
    if (data.capacidad_tanque !== undefined) updateData.capacidad_tanque = data.capacidad_tanque;
    if (data.id_tipo_combustible_preferido !== undefined) updateData.id_tipo_combustible_preferido = data.id_tipo_combustible_preferido;
    if (data.activo !== undefined) updateData.activo = data.activo;
    if (data.dni !== undefined) updateData.dni = data.dni;
    if (data.nombre_chofer !== undefined) updateData.nombre_chofer = data.nombre_chofer;
    if (data.apellido_chofer !== undefined) updateData.apellido_chofer = data.apellido_chofer;
    if (data.numero_licencia !== undefined) updateData.numero_licencia = data.numero_licencia;

    const camion = await this.prisma.camiones.update({
      where: { id_camion: id },
      data: updateData,
    });

    return {
      ...camion,
      año: camion.a_o || null,
      capacidad_tanque: camion.capacidad_tanque ? Number(camion.capacidad_tanque) : null,
      fecha_registro: camion.fecha_registro?.toISOString() || null,
    };
  }

  async remove(id: number) {
    await this.prisma.camiones.update({
      where: { id_camion: id },
      data: {
        activo: false,
      },
    });

    return { message: 'Camión marcado como inactivo' };
  }

  async hardDelete(id: number) {
    await this.prisma.camiones.delete({
      where: { id_camion: id },
    });

    return { message: 'Camión eliminado permanentemente' };
  }
}
