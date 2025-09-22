import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEtapaDto, UpdateEtapaDto } from '../dto/etapas.dto';

@Injectable()
export class EtapasService {
  constructor(private prisma: PrismaService) {}

  async create(createEtapaDto: CreateEtapaDto) {
    const { id_proyecto, orden, ...rest } = createEtapaDto;

    let finalOrden = orden;
    if (!finalOrden) {
      const maxOrden = await this.prisma.etapas.findFirst({
        where: { id_proyecto },
        select: { orden: true },
        orderBy: { orden: 'desc' },
      });
      finalOrden = maxOrden && maxOrden.orden !== null ? maxOrden.orden + 1 : 1;
    }

    return this.prisma.etapas.create({
      data: {
        id_proyecto,
        orden: finalOrden,
        ...rest,
      },
    });
  }

  async findAll() {
    return this.prisma.etapas.findMany({
      orderBy: { orden: 'asc' },
    });
  }

  async findByProyecto(idProyecto: number) {
    return this.prisma.etapas.findMany({
      where: { id_proyecto: idProyecto },
      orderBy: { orden: 'asc' },
    });
  }

  async findOne(id: number) {
    const etapa = await this.prisma.etapas.findUnique({
      where: { id_etapa: id },
    });

    if (!etapa) {
      throw new NotFoundException(`Etapa with ID ${id} not found`);
    }

    return etapa;
  }

  async update(id: number, updateEtapaDto: UpdateEtapaDto) {
    await this.findOne(id);

    return this.prisma.etapas.update({
      where: { id_etapa: id },
      data: updateEtapaDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.etapas.delete({
      where: { id_etapa: id },
    });
  }
}