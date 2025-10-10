import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEmpresaDto, UpdateEmpresaDto, EmpresaFilterDto } from '../dto/empresas.dto';

@Injectable()
export class EmpresasService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: EmpresaFilterDto) {
    const where: any = {};

    if (filters?.Raz_n_social) {
      where.Raz_n_social = { contains: filters.Raz_n_social };
    }

    if (filters?.N__documento) {
      where.N__documento = { contains: filters.N__documento };
    }

    if (filters?.Tipo) {
      where.Tipo = { contains: filters.Tipo };
    }

    const empresas = await this.prisma.empresas_2025.findMany({
      where,
      orderBy: [
        { Raz_n_social: 'asc' }
      ],
    });

    // Convertir a mayúsculas
    return empresas.map(e => ({
      ...e,
      Raz_n_social: e.Raz_n_social?.toUpperCase() || null,
      Direcci_n: e.Direcci_n?.toUpperCase() || null,
    }));
  }

  async findOne(codigo: string) {
    const empresa = await this.prisma.empresas_2025.findUnique({
      where: { C_digo: codigo },
    });

    if (!empresa) return null;

    // Convertir a mayúsculas
    return {
      ...empresa,
      Raz_n_social: empresa.Raz_n_social?.toUpperCase() || null,
      Direcci_n: empresa.Direcci_n?.toUpperCase() || null,
    };
  }

  async create(data: CreateEmpresaDto) {
    const empresa = await this.prisma.empresas_2025.create({
      data: {
        C_digo: data.C_digo,
        Raz_n_social: data.Raz_n_social || null,
        N__documento: data.N__documento || null,
        Tipo: data.Tipo || null,
        Direcci_n: data.Direcci_n || null,
      },
    });

    return empresa;
  }

  async update(codigo: string, data: UpdateEmpresaDto) {
    const updateData: any = {};

    if (data.Raz_n_social !== undefined) updateData.Raz_n_social = data.Raz_n_social;
    if (data.N__documento !== undefined) updateData.N__documento = data.N__documento;
    if (data.Tipo !== undefined) updateData.Tipo = data.Tipo;
    if (data.Direcci_n !== undefined) updateData.Direcci_n = data.Direcci_n;

    const empresa = await this.prisma.empresas_2025.update({
      where: { C_digo: codigo },
      data: updateData,
    });

    return empresa;
  }

  async remove(codigo: string) {
    await this.prisma.empresas_2025.delete({
      where: { C_digo: codigo },
    });

    return { message: 'Empresa eliminada permanentemente' };
  }
}
