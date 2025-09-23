import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubEtapaDto, UpdateSubEtapaDto } from '../dto/sub-etapas.dto';

@Injectable()
export class SubEtapasService {
  constructor(private prisma: PrismaService) {}

  async create(createSubEtapaDto: CreateSubEtapaDto) {
    return this.prisma.sub_etapas.create({
      data: createSubEtapaDto,
      include: {
        subproyecto: true,
        subsector: {
          include: {
            subfrente: {
              include: {
                subpartida: true,
              },
            },
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.sub_etapas.findMany({
      where: { activo: true },
      include: {
        subproyecto: true,
        subsector: {
          where: { activo: true },
          include: {
            subfrente: {
              where: { activo: true },
              include: {
                subpartida: {
                  where: { activo: true },
                },
              },
            },
          },
        },
      },
      orderBy: { orden: 'asc' },
    });
  }

  async findBySubproyecto(idSubproyecto: number) {
    return this.prisma.sub_etapas.findMany({
      where: {
        id_subproyecto: idSubproyecto,
        activo: true
      },
      include: {
        subproyecto: true,
        subsector: {
          where: { activo: true },
          include: {
            subfrente: {
              where: { activo: true },
              include: {
                subpartida: {
                  where: { activo: true },
                },
              },
            },
          },
        },
      },
      orderBy: { orden: 'asc' },
    });
  }

  async findOne(id: number) {
    const subEtapa = await this.prisma.sub_etapas.findUnique({
      where: { id_sub_etapa: id },
      include: {
        subproyecto: true,
        subsector: {
          where: { activo: true },
          include: {
            subfrente: {
              where: { activo: true },
              include: {
                subpartida: {
                  where: { activo: true },
                },
              },
            },
          },
        },
      },
    });

    if (!subEtapa) {
      throw new NotFoundException(`Sub-etapa con ID ${id} no encontrada`);
    }

    return subEtapa;
  }

  async update(id: number, updateSubEtapaDto: UpdateSubEtapaDto) {
    const subEtapa = await this.prisma.sub_etapas.findUnique({
      where: { id_sub_etapa: id },
    });

    if (!subEtapa) {
      throw new NotFoundException(`Sub-etapa con ID ${id} no encontrada`);
    }

    return this.prisma.sub_etapas.update({
      where: { id_sub_etapa: id },
      data: updateSubEtapaDto,
      include: {
        subproyecto: true,
        subsector: {
          include: {
            subfrente: {
              include: {
                subpartida: true,
              },
            },
          },
        },
      },
    });
  }

  async remove(id: number) {
    const subEtapa = await this.prisma.sub_etapas.findUnique({
      where: { id_sub_etapa: id },
    });

    if (!subEtapa) {
      throw new NotFoundException(`Sub-etapa con ID ${id} no encontrada`);
    }

    // Soft delete
    return this.prisma.sub_etapas.update({
      where: { id_sub_etapa: id },
      data: { activo: false },
    });
  }
}