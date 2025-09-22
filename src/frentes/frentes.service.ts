import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFrenteDto, UpdateFrenteDto } from '../dto/frentes.dto';

@Injectable()
export class FrentesService {
  constructor(private prisma: PrismaService) {}

  async create(createFrenteDto: CreateFrenteDto) {
    const { id_sector, orden, ...rest } = createFrenteDto;

    let finalOrden = orden;
    if (!finalOrden) {
      const maxOrden = await this.prisma.frente.findFirst({
        where: { id_sector },
        select: { orden: true },
        orderBy: { orden: 'desc' },
      });
      finalOrden = maxOrden && maxOrden.orden !== null ? maxOrden.orden + 1 : 1;
    }

    return this.prisma.frente.create({
      data: {
        id_sector,
        orden: finalOrden,
        ...rest,
      },
    });
  }

  async findAll() {
    return this.prisma.frente.findMany({
      orderBy: { orden: 'asc' },
    });
  }

  async findBySector(idSector: number) {
    return this.prisma.frente.findMany({
      where: { id_sector: idSector },
      orderBy: { orden: 'asc' },
    });
  }

  async findOne(id: number) {
    const frente = await this.prisma.frente.findUnique({
      where: { id_frente: id },
    });

    if (!frente) {
      throw new NotFoundException(`Frente with ID ${id} not found`);
    }

    return frente;
  }

  async update(id: number, updateFrenteDto: UpdateFrenteDto) {
    await this.findOne(id);

    return this.prisma.frente.update({
      where: { id_frente: id },
      data: updateFrenteDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.frente.delete({
      where: { id_frente: id },
    });
  }
}