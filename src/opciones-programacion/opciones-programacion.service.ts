import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OpcionesProgramacionService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.opciones_programacion.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async create(nombre: string) {
    return this.prisma.opciones_programacion.create({
      data: { nombre: nombre.trim().toUpperCase() },
    });
  }

  async update(id: number, nombre: string) {
    const exists = await this.prisma.opciones_programacion.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Opción no encontrada');
    return this.prisma.opciones_programacion.update({
      where: { id },
      data: { nombre: nombre.trim().toUpperCase() },
    });
  }

  async remove(id: number) {
    const exists = await this.prisma.opciones_programacion.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Opción no encontrada');
    return this.prisma.opciones_programacion.delete({ where: { id } });
  }
}
