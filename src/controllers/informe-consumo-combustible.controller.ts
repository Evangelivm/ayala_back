import {
  Controller,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { InformeConsumoCombustibleService } from '../services/informe-consumo-combustible.service';
import {
  InformeConsumoCombustibleFilterDto,
  InformeConsumoCombustibleFilterSchema,
} from '../dto/informe-consumo-combustible.dto';

@Controller('informe-consumo-combustible')
export class InformeConsumoCombustibleController {
  constructor(private readonly informeConsumoCombustibleService: InformeConsumoCombustibleService) {}

  @Get()
  async findAll(@Query() query: any) {
    try {
      const filters = InformeConsumoCombustibleFilterSchema.parse({
        fecha_desde: query.fecha_desde || undefined,
        fecha_hasta: query.fecha_hasta || undefined,
        id_equipo: query.id_equipo ? parseInt(query.id_equipo) : undefined,
      });

      return await this.informeConsumoCombustibleService.findAll(filters);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}