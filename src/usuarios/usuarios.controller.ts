import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { z } from 'zod';
import { UsuariosService } from './usuarios.service';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

const RolEnum = z.enum(['ADMIN', 'ALMACENERO', 'AUXILIAR', 'USER']);

const CreateUsuarioSchema = z.object({
  usuario: z.string().min(3, 'El usuario debe tener al menos 3 caracteres'),
  nombre: z.string().min(1, 'El nombre es requerido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  rol: RolEnum.optional().default('USER'),
});

const UpdateUsuarioSchema = z.object({
  nombre: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  rol: RolEnum.optional(),
  activo: z.boolean().optional(),
});

type CreateUsuarioDto = z.infer<typeof CreateUsuarioSchema>;
type UpdateUsuarioDto = z.infer<typeof UpdateUsuarioSchema>;

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.usuariosService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(CreateUsuarioSchema)) dto: CreateUsuarioDto,
  ) {
    return this.usuariosService.create(dto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUsuarioSchema)) dto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(+id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id') id: string) {
    return this.usuariosService.deactivate(+id);
  }
}
