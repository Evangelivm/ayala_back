import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RubroService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const rubros = await this.prisma.rubro.findMany({
      orderBy: [
        { codigo: 'asc' }
      ],
    });

    return rubros;
  }

  async findOne(id: number) {
    const rubro = await this.prisma.rubro.findUnique({
      where: { id },
    });

    return rubro;
  }

  async findByCodigo(codigo: string) {
    const rubro = await this.prisma.rubro.findFirst({
      where: { codigo },
    });

    return rubro;
  }
}
