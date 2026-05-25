import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

const LoginSchema = z.object({
  usuario: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

type LoginDto = z.infer<typeof LoginSchema>;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto) {
    return this.authService.login(dto.usuario, dto.password);
  }
}
