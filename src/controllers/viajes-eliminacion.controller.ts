import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { ViajesEliminacionService } from '../services/viajes-eliminacion.service';
import {
  ViajesEliminacionDto,
  UpdateViajesEliminacionDto,
  ViajesEliminacionFilterDto,
  ViajesEliminacionSchema,
  UpdateViajesEliminacionSchema,
  ViajesEliminacionFilterSchema,
} from '../dto/viajes-eliminacion.dto';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

@Controller('viajes-eliminacion')
export class ViajesEliminacionController {
  constructor(private readonly viajesEliminacionService: ViajesEliminacionService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(ViajesEliminacionSchema))
  async create(@Body() createViajesEliminacionDto: ViajesEliminacionDto) {
    try {
      return await this.viajesEliminacionService.create(createViajesEliminacionDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  async findAll(@Query() query: any) {
    try {
      // Validar y parsear filtros
      const filters = ViajesEliminacionFilterSchema.parse({
        ...query,
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 10,
        id_proyecto: query.id_proyecto ? parseInt(query.id_proyecto) : undefined,
        activo: query.activo !== undefined ? query.activo === 'true' : undefined,
      });

      return await this.viajesEliminacionService.findAll(filters);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.viajesEliminacionService.findOne(id);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateViajesEliminacionSchema))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateViajesEliminacionDto: UpdateViajesEliminacionDto,
  ) {
    try {
      return await this.viajesEliminacionService.update(id, updateViajesEliminacionDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.viajesEliminacionService.remove(id);
  }

  @Delete(':id/hard')
  async hardDelete(@Param('id', ParseIntPipe) id: number) {
    return await this.viajesEliminacionService.hardDelete(id);
  }
}