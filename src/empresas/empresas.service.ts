import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEmpresaDto, UpdateEmpresaDto, EmpresaFilterDto } from '../dto/empresas.dto';

@Injectable()
export class EmpresasService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: EmpresaFilterDto) {
    const where: any = {};

    if (filters?.Raz_n_social) {
      where.razon_social = { contains: filters.Raz_n_social };
    }

    if (filters?.N__documento) {
      where.nro_documento = { contains: filters.N__documento };
    }

    if (filters?.Tipo) {
      where.tipo = { contains: filters.Tipo };
    }

    const empresas = await this.prisma.empresas_2025.findMany({
      where,
      orderBy: [
        { razon_social: 'asc' }
      ],
    });

    // Convertir a mayúsculas
    return empresas.map(e => ({
      ...e,
      razon_social: e.razon_social?.toUpperCase() || null,
      direccion: e.direccion?.toUpperCase() || null,
    }));
  }

  async findOne(codigo: string) {
    const empresa = await this.prisma.empresas_2025.findUnique({
      where: { codigo: codigo },
    });

    if (!empresa) return null;

    // Convertir a mayúsculas
    return {
      ...empresa,
      razon_social: empresa.razon_social?.toUpperCase() || null,
      direccion: empresa.direccion?.toUpperCase() || null,
    };
  }

  async create(data: CreateEmpresaDto) {
    const empresa = await this.prisma.empresas_2025.create({
      data: {
        codigo: data.C_digo,
        razon_social: data.Raz_n_social || null,
        nro_documento: data.N__documento || null,
        tipo: data.Tipo || null,
        direccion: data.Direcci_n || null,
      },
    });

    return empresa;
  }

  async update(codigo: string, data: UpdateEmpresaDto) {
    const updateData: any = {};

    if (data.Raz_n_social !== undefined) updateData.razon_social = data.Raz_n_social;
    if (data.N__documento !== undefined) updateData.nro_documento = data.N__documento;
    if (data.Tipo !== undefined) updateData.tipo = data.Tipo;
    if (data.Direcci_n !== undefined) updateData.direccion = data.Direcci_n;

    const empresa = await this.prisma.empresas_2025.update({
      where: { codigo: codigo },
      data: updateData,
    });

    return empresa;
  }

  async remove(codigo: string) {
    await this.prisma.empresas_2025.delete({
      where: { codigo: codigo },
    });

    return { message: 'Empresa eliminada permanentemente' };
  }
}
