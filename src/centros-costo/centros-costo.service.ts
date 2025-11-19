import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CentrosCostoService {
  constructor(private prisma: PrismaService) {}

  // Obtener centros de costo de nivel 1 (2 dígitos)
  async getNivel1() {
    const allCentros = await this.prisma.centros_de_costos_2025.findMany({
      select: {
        id: true,
        CecoCodi: true,
        Centro_de_costo: true,
      },
      orderBy: {
        CecoCodi: 'asc',
      },
    });

    // Filtrar códigos de exactamente 2 dígitos
    return allCentros.filter((centro) => {
      const codigo = centro.CecoCodi?.trim() || '';
      return /^[0-9]{2}$/.test(codigo);
    });
  }

  // Obtener centros de costo de nivel 2 (4 dígitos) por padre
  async getNivel2(codigoPadre: string) {
    const centros = await this.prisma.centros_de_costos_2025.findMany({
      where: {
        CecoCodi: {
          startsWith: codigoPadre,
        },
      },
      select: {
        id: true,
        CecoCodi: true,
        Centro_de_costo: true,
      },
      orderBy: {
        CecoCodi: 'asc',
      },
    });

    // Filtrar códigos de exactamente 4 dígitos que empiezan con el padre
    return centros.filter((centro) => {
      const codigo = centro.CecoCodi?.trim() || '';
      return /^[0-9]{4}$/.test(codigo) && codigo.startsWith(codigoPadre);
    });
  }

  // Obtener centros de costo de nivel 3 (6 dígitos) por padre
  async getNivel3(codigoPadre: string) {
    const centros = await this.prisma.centros_de_costos_2025.findMany({
      where: {
        CecoCodi: {
          startsWith: codigoPadre,
        },
      },
      select: {
        id: true,
        CecoCodi: true,
        Centro_de_costo: true,
      },
      orderBy: {
        CecoCodi: 'asc',
      },
    });

    // Filtrar códigos de exactamente 6 dígitos que empiezan con el padre
    return centros.filter((centro) => {
      const codigo = centro.CecoCodi?.trim() || '';
      return /^[0-9]{6}$/.test(codigo) && codigo.startsWith(codigoPadre);
    });
  }

  // Obtener todos los centros de costo (para búsqueda general)
  async getAll() {
    return this.prisma.centros_de_costos_2025.findMany({
      select: {
        id: true,
        CecoCodi: true,
        Centro_de_costo: true,
      },
      orderBy: {
        CecoCodi: 'asc',
      },
    });
  }

  // Buscar por código específico
  async findByCodigo(codigo: string) {
    return this.prisma.centros_de_costos_2025.findFirst({
      where: {
        CecoCodi: codigo,
      },
      select: {
        id: true,
        CecoCodi: true,
        Centro_de_costo: true,
      },
    });
  }
}
