import { Injectable } from '@nestjs/common';
import { PrismaThirdService } from '../prisma/prisma-third.service';

@Injectable()
export class ItemsService {
  constructor(private prismaThird: PrismaThirdService) {}

  /**
   * Corrige Mojibake: bytes UTF-8 almacenados en columna latin1.
   * mysql2 los devuelve como si fueran latin1, cada byte se convierte
   * en un char U+00xx. Esta función revierte eso decodificando como UTF-8.
   */
  private fixMojibake(str: string | null | undefined): string | null | undefined {
    if (!str) return str;
    try {
      const bytes: number[] = [];
      for (let i = 0; i < str.length; i++) {
        const cp = str.charCodeAt(i);
        if (cp > 0xFF) return str; // ya es unicode real, no mojibake
        bytes.push(cp);
      }
      const decoded = Buffer.from(bytes).toString('utf8');
      return decoded.includes('�') ? str : decoded;
    } catch {
      return str;
    }
  }

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

    return items.map((item) => ({
      ...item,
      descripcion: this.fixMojibake(item.descripcion) ?? item.descripcion,
      marca: this.fixMojibake(item.marca),
      modelo: this.fixMojibake(item.modelo),
    }));
  }

  async findOne(codigo: string) {
    const item = await this.prismaThird.listado_items_2025.findUnique({
      where: { codigo },
    });
    if (!item) return null;
    return {
      ...item,
      descripcion: this.fixMojibake(item.descripcion) ?? item.descripcion,
      marca: this.fixMojibake(item.marca),
      modelo: this.fixMojibake(item.modelo),
    };
  }

  async search(query: string) {
    const items = await this.prismaThird.listado_items_2025.findMany({
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

    return items.map((item) => ({
      ...item,
      descripcion: this.fixMojibake(item.descripcion) ?? item.descripcion,
      marca: this.fixMojibake(item.marca),
      modelo: this.fixMojibake(item.modelo),
    }));
  }
}
