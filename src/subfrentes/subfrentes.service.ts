import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubfrenteDto, UpdateSubfrenteDto } from '../dto/subfrentes.dto';

@Injectable()
export class SubfrentesService {
  constructor(private prisma: PrismaService) {}

  async create(createSubfrenteDto: CreateSubfrenteDto) {
    return this.prisma.subfrente.create({
      data: createSubfrenteDto,
      include: {
        subsector: true,
        subpartida: true,
      },
    });
  }

  async findAll() {
    return this.prisma.subfrente.findMany({
      where: { activo: true },
      include: {
        subsector: true,
        subpartida: {
          where: { activo: true },
        },
      },
      orderBy: { orden: 'asc' },
    });
  }

  async findBySubsector(idSubsector: number) {
    return this.prisma.subfrente.findMany({
      where: {
        id_subsector: idSubsector,
        activo: true
      },
      include: {
        subsector: true,
        subpartida: {
          where: { activo: true },
        },
      },
      orderBy: { orden: 'asc' },
    });
  }

  async findOne(id: number) {
    const subfrente = await this.prisma.subfrente.findUnique({
      where: { id_subfrente: id },
      include: {
        subsector: true,
        subpartida: {
          where: { activo: true },
        },
      },
    });

    if (!subfrente) {
      throw new NotFoundException(`Subfrente con ID ${id} no encontrado`);
    }

    return subfrente;
  }

  async update(id: number, updateSubfrenteDto: UpdateSubfrenteDto) {
    const subfrente = await this.prisma.subfrente.findUnique({
      where: { id_subfrente: id },
    });

    if (!subfrente) {
      throw new NotFoundException(`Subfrente con ID ${id} no encontrado`);
    }

    return this.prisma.subfrente.update({
      where: { id_subfrente: id },
      data: updateSubfrenteDto,
      include: {
        subsector: true,
        subpartida: true,
      },
    });
  }

  async remove(id: number) {
    const subfrente = await this.prisma.subfrente.findUnique({
      where: { id_subfrente: id },
    });

    if (!subfrente) {
      throw new NotFoundException(`Subfrente con ID ${id} no encontrado`);
    }

    return this.prisma.subfrente.update({
      where: { id_subfrente: id },
      data: { activo: false },
    });
  }
}