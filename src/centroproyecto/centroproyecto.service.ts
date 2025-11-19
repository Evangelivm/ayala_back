import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CentroproyectoService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const centros = await this.prisma.centroproyecto.findMany({
      orderBy: [
        { codigo: 'asc' }
      ],
    });

    return centros;
  }

  async findOne(id: number) {
    const centro = await this.prisma.centroproyecto.findUnique({
      where: { id },
    });

    return centro;
  }

  async findByCodigo(codigo: string) {
    const centro = await this.prisma.centroproyecto.findFirst({
      where: { codigo },
    });

    return centro;
  }
}
