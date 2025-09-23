import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubpartidaDto, UpdateSubpartidaDto } from '../dto/subpartidas.dto';

@Injectable()
export class SubpartidasService {
  constructor(private prisma: PrismaService) {}

  async create(createSubpartidaDto: CreateSubpartidaDto) {
    // Calculate total if not provided
    const data = { ...createSubpartidaDto };
    if (!data.total && data.cantidad && data.precio_unitario) {
      data.total = data.cantidad * data.precio_unitario;
    }

    return this.prisma.subpartida.create({
      data,
      include: {
        subfrente: true,
      },
    });
  }

  async findAll() {
    return this.prisma.subpartida.findMany({
      where: { activo: true },
      include: {
        subfrente: true,
      },
      orderBy: { orden: 'asc' },
    });
  }

  async findBySubfrente(idSubfrente: number) {
    return this.prisma.subpartida.findMany({
      where: {
        id_subfrente: idSubfrente,
        activo: true
      },
      include: {
        subfrente: true,
      },
      orderBy: { orden: 'asc' },
    });
  }

  async findOne(id: number) {
    const subpartida = await this.prisma.subpartida.findUnique({
      where: { id_subpartida: id },
      include: {
        subfrente: true,
      },
    });

    if (!subpartida) {
      throw new NotFoundException(`Subpartida con ID ${id} no encontrada`);
    }

    return subpartida;
  }

  async update(id: number, updateSubpartidaDto: UpdateSubpartidaDto) {
    const subpartida = await this.prisma.subpartida.findUnique({
      where: { id_subpartida: id },
    });

    if (!subpartida) {
      throw new NotFoundException(`Subpartida con ID ${id} no encontrada`);
    }

    // Calculate total if not provided
    const data = { ...updateSubpartidaDto };
    if (!data.total && data.cantidad && data.precio_unitario) {
      data.total = data.cantidad * data.precio_unitario;
    }

    return this.prisma.subpartida.update({
      where: { id_subpartida: id },
      data,
      include: {
        subfrente: true,
      },
    });
  }

  async remove(id: number) {
    const subpartida = await this.prisma.subpartida.findUnique({
      where: { id_subpartida: id },
    });

    if (!subpartida) {
      throw new NotFoundException(`Subpartida con ID ${id} no encontrada`);
    }

    return this.prisma.subpartida.update({
      where: { id_subpartida: id },
      data: { activo: false },
    });
  }
}