import { Injectable } from '@nestjs/common';
import { PrismaThirdService } from '../prisma/prisma-third.service';

@Injectable()
export class ItemsService {
  constructor(private prismaThird: PrismaThirdService) {}

  async findAll() {
    const items = await this.prismaThird.listado_items_2025.findMany({
      where: {
        activo: true,
      },
      select: {
        codigo: true,
        descripcion: true,
        precio_unitario: true,
        u_m: true,
        stock_minimo: true,
        stock_maximo: true,
        marca: true,
        modelo: true,
      },
      orderBy: {
        descripcion: 'asc',
      },
    });

    return items;
  }

  async findOne(codigo: string) {
    return this.prismaThird.listado_items_2025.findUnique({
      where: { codigo },
    });
  }

  async search(query: string) {
    return this.prismaThird.listado_items_2025.findMany({
      where: {
        activo: true,
        OR: [
          {
            codigo: {
              contains: query,
            },
          },
          {
            descripcion: {
              contains: query,
            },
          },
        ],
      },
      select: {
        codigo: true,
        descripcion: true,
        precio_unitario: true,
        u_m: true,
        stock_minimo: true,
        stock_maximo: true,
        marca: true,
        modelo: true,
      },
      orderBy: {
        descripcion: 'asc',
      },
      take: 50,
    });
  }
}
