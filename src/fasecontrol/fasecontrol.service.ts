import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FasecontrolService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const fases = await this.prisma.fasecontrol.findMany({
      orderBy: [
        { codigo: 'asc' }
      ],
    });

    return fases;
  }

  async findOne(id: number) {
    const fase = await this.prisma.fasecontrol.findUnique({
      where: { id },
    });

    return fase;
  }

  async findByCodigo(codigo: string) {
    const fase = await this.prisma.fasecontrol.findFirst({
      where: { codigo },
    });

    return fase;
  }
}
