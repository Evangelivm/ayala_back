import { Injectable } from '@nestjs/common';
import { PrismaThirdService } from '../prisma/prisma-third.service';

@Injectable()
export class TipoDetraccionService {
  constructor(private prismaThird: PrismaThirdService) {}

  async findAll() {
    const tiposDetraccion = await this.prismaThird.tipo_detraccion.findMany({
      orderBy: {
        id_tipo_detraccion: 'asc',
      },
    });

    return tiposDetraccion;
  }
}
