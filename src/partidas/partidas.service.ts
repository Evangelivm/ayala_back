import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartidaDto, UpdatePartidaDto } from '../dto/partidas.dto';

@Injectable()
export class PartidasService {
  constructor(private prisma: PrismaService) {}

  async create(createPartidaDto: CreatePartidaDto) {
    const { id_frente, orden, total, ...rest } = createPartidaDto;

    let finalOrden = orden;
    if (!finalOrden) {
      const maxOrden = await this.prisma.partida.findFirst({
        where: { id_frente },
        select: { orden: true },
        orderBy: { orden: 'desc' },
      });
      finalOrden = maxOrden && maxOrden.orden !== null ? maxOrden.orden + 1 : 1;
    }

    return this.prisma.partida.create({
      data: {
        id_frente,
        orden: finalOrden,
        ...rest,
      },
    });
  }

  async findAll() {
    return this.prisma.partida.findMany({
      orderBy: { orden: 'asc' },
    });
  }

  async findByFrente(idFrente: number) {
    return this.prisma.partida.findMany({
      where: { id_frente: idFrente },
      orderBy: { orden: 'asc' },
    });
  }

  async findOne(id: number) {
    const partida = await this.prisma.partida.findUnique({
      where: { id_partida: id },
    });

    if (!partida) {
      throw new NotFoundException(`Partida with ID ${id} not found`);
    }

    return partida;
  }

  async update(id: number, updatePartidaDto: UpdatePartidaDto) {
    await this.findOne(id);

    return this.prisma.partida.update({
      where: { id_partida: id },
      data: updatePartidaDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.partida.delete({
      where: { id_partida: id },
    });
  }
}