import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaThirdService } from '../prisma/prisma-third.service';

@Injectable()
export class AuthService {
  constructor(private readonly prismaThird: PrismaThirdService) {}

  async login(usuario: string, password: string) {
    const user = await this.prismaThird.usuarios.findUnique({
      where: { usuario },
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true,
        password: true,
      },
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    let isValid = false;

    if (user.password.startsWith('$argon2')) {
      // Contraseña hasheada con argon2id
      isValid = await argon2.verify(user.password, password);
    } else {
      // Contraseña en texto plano (legado) — verificar y migrar a argon2id
      isValid = user.password === password;
      if (isValid) {
        const hash = await argon2.hash(password, { type: argon2.argon2id });
        await this.prismaThird.usuarios.update({
          where: { id: user.id },
          data: { password: hash },
        });
      }
    }

    if (!isValid) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    return { id: user.id, nombre: user.nombre, rol: user.rol };
  }
}
