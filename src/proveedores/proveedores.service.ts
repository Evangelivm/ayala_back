import { Injectable } from '@nestjs/common';
import { PrismaThirdService } from '../prisma/prisma-third.service';

@Injectable()
export class ProveedoresService {
  constructor(private prismaThird: PrismaThirdService) {}

  async findAll() {
    const proveedores = await this.prismaThird.proveedores.findMany({
      where: {
        activo: true,
      },
      orderBy: {
        nombre_proveedor: 'asc',
      },
    });

    return proveedores;
  }

  async findOne(id: number) {
    return this.prismaThird.proveedores.findUnique({
      where: { id_proveedor: id },
    });
  }

  async findByDocumento(ruc: string) {
    return this.prismaThird.proveedores.findFirst({
      where: { ruc },
    });
  }
}
