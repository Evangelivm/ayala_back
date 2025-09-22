import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectorDto, UpdateSectorDto } from '../dto/sectores.dto';

@Injectable()
export class SectoresService {
  constructor(private prisma: PrismaService) {}

  async create(createSectorDto: CreateSectorDto) {
    const { id_etapa, orden, ...rest } = createSectorDto;

    let finalOrden = orden;
    if (!finalOrden) {
      const maxOrden = await this.prisma.sector.findFirst({
        where: { id_etapa },
        select: { orden: true },
        orderBy: { orden: 'desc' },
      });
      finalOrden = maxOrden && maxOrden.orden !== null ? maxOrden.orden + 1 : 1;
    }

    return this.prisma.sector.create({
      data: {
        id_etapa,
        orden: finalOrden,
        ...rest,
      },
    });
  }

  async findAll() {
    return this.prisma.sector.findMany({
      orderBy: { orden: 'asc' },
    });
  }

  async findByEtapa(idEtapa: number) {
    return this.prisma.sector.findMany({
      where: { id_etapa: idEtapa },
      orderBy: { orden: 'asc' },
    });
  }

  async findOne(id: number) {
    const sector = await this.prisma.sector.findUnique({
      where: { id_sector: id },
    });

    if (!sector) {
      throw new NotFoundException(`Sector with ID ${id} not found`);
    }

    return sector;
  }

  async update(id: number, updateSectorDto: UpdateSectorDto) {
    await this.findOne(id);

    return this.prisma.sector.update({
      where: { id_sector: id },
      data: updateSectorDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.sector.delete({
      where: { id_sector: id },
    });
  }
}