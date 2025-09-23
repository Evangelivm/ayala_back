import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubsectorDto, UpdateSubsectorDto } from '../dto/subsectores.dto';

@Injectable()
export class SubsectoresService {
  constructor(private prisma: PrismaService) {}

  async create(createSubsectorDto: CreateSubsectorDto) {
    return this.prisma.subsector.create({
      data: createSubsectorDto,
      include: {
        sub_etapa: true,
        subfrente: {
          include: {
            subpartida: true,
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.subsector.findMany({
      where: { activo: true },
      include: {
        sub_etapa: true,
        subfrente: {
          where: { activo: true },
          include: {
            subpartida: {
              where: { activo: true },
            },
          },
        },
      },
      orderBy: { orden: 'asc' },
    });
  }

  async findBySubEtapa(idSubEtapa: number) {
    return this.prisma.subsector.findMany({
      where: {
        id_sub_etapa: idSubEtapa,
        activo: true
      },
      include: {
        sub_etapa: true,
        subfrente: {
          where: { activo: true },
          include: {
            subpartida: {
              where: { activo: true },
            },
          },
        },
      },
      orderBy: { orden: 'asc' },
    });
  }

  async findOne(id: number) {
    const subsector = await this.prisma.subsector.findUnique({
      where: { id_subsector: id },
      include: {
        sub_etapa: true,
        subfrente: {
          where: { activo: true },
          include: {
            subpartida: {
              where: { activo: true },
            },
          },
        },
      },
    });

    if (!subsector) {
      throw new NotFoundException(`Subsector con ID ${id} no encontrado`);
    }

    return subsector;
  }

  async update(id: number, updateSubsectorDto: UpdateSubsectorDto) {
    const subsector = await this.prisma.subsector.findUnique({
      where: { id_subsector: id },
    });

    if (!subsector) {
      throw new NotFoundException(`Subsector con ID ${id} no encontrado`);
    }

    return this.prisma.subsector.update({
      where: { id_subsector: id },
      data: updateSubsectorDto,
      include: {
        sub_etapa: true,
        subfrente: {
          include: {
            subpartida: true,
          },
        },
      },
    });
  }

  async remove(id: number) {
    const subsector = await this.prisma.subsector.findUnique({
      where: { id_subsector: id },
    });

    if (!subsector) {
      throw new NotFoundException(`Subsector con ID ${id} no encontrado`);
    }

    return this.prisma.subsector.update({
      where: { id_subsector: id },
      data: { activo: false },
    });
  }
}