import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaThirdService } from '../prisma/prisma-third.service';

@Injectable()
export class UsuariosService {
  constructor(private readonly prismaThird: PrismaThirdService) {}

  async findAll() {
    return this.prismaThird.usuarios.findMany({
      select: {
        id: true,
        usuario: true,
        nombre: true,
        rol: true,
        activo: true,
        fecha_creacion: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(data: {
    usuario: string;
    nombre: string;
    password: string;
    rol?: string;
  }) {
    const exists = await this.prismaThird.usuarios.findUnique({
      where: { usuario: data.usuario },
    });
    if (exists) {
      throw new BadRequestException(`El usuario "${data.usuario}" ya existe`);
    }

    const hash = await argon2.hash(data.password, { type: argon2.argon2id });

    return this.prismaThird.usuarios.create({
      data: {
        usuario: data.usuario,
        nombre: data.nombre,
        password: hash,
        rol: (data.rol as any) || 'USER',
        activo: true,
      },
      select: {
        id: true,
        usuario: true,
        nombre: true,
        rol: true,
        activo: true,
        fecha_creacion: true,
      },
    });
  }

  async update(
    id: number,
    data: {
      nombre?: string;
      password?: string;
      rol?: string;
      activo?: boolean;
    },
  ) {
    const user = await this.prismaThird.usuarios.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const updateData: Record<string, unknown> = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.rol !== undefined) updateData.rol = data.rol;
    if (data.activo !== undefined) updateData.activo = data.activo;
    if (data.password) {
      updateData.password = await argon2.hash(data.password, {
        type: argon2.argon2id,
      });
    }

    return this.prismaThird.usuarios.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        usuario: true,
        nombre: true,
        rol: true,
        activo: true,
        fecha_creacion: true,
      },
    });
  }

  async deactivate(id: number) {
    const user = await this.prismaThird.usuarios.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    return this.prismaThird.usuarios.update({
      where: { id },
      data: { activo: false },
      select: { id: true, usuario: true, nombre: true, rol: true, activo: true },
    });
  }
}
