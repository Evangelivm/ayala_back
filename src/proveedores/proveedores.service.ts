import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProveedoresService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const proveedores = await this.prisma.proveedores2025.findMany({
      orderBy: {
        razon_social: 'asc',
      },
    });

    return proveedores;
  }

  async findOne(id: number) {
    return this.prisma.proveedores2025.findUnique({
      where: { id },
    });
  }

  async findByDocumento(nro_documento: string) {
    return this.prisma.proveedores2025.findFirst({
      where: { nro_documento },
    });
  }
}
