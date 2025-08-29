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
import { ReportesPlantillerosService } from '../services/reportes-plantilleros.service';
import {
  ReportesPlantillerosDto,
  UpdateReportesPlantillerosDto,
  ReportesPlantillerosFilterDto,
  ReportesPlantillerosSchema,
  UpdateReportesPlantillerosSchema,
  ReportesPlantillerosFilterSchema,
} from '../dto/reportes-plantilleros.dto';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

@Controller('reportes-plantilleros')
export class ReportesPlantillerosController {
  constructor(private readonly reportesPlantillerosService: ReportesPlantillerosService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(ReportesPlantillerosSchema))
  async create(@Body() createReportesPlantillerosDto: ReportesPlantillerosDto) {
    try {
      return await this.reportesPlantillerosService.create(createReportesPlantillerosDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  async findAll(@Query() query: any) {
    try {
      // Validar y parsear filtros
      const filters = ReportesPlantillerosFilterSchema.parse({
        ...query,
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 10,
        id_proyecto: query.id_proyecto ? parseInt(query.id_proyecto) : undefined,
        activo: query.activo !== undefined ? query.activo === 'true' : undefined,
      });

      return await this.reportesPlantillerosService.findAll(filters);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.reportesPlantillerosService.findOne(id);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateReportesPlantillerosSchema))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateReportesPlantillerosDto: UpdateReportesPlantillerosDto,
  ) {
    try {
      return await this.reportesPlantillerosService.update(id, updateReportesPlantillerosDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.reportesPlantillerosService.remove(id);
  }

  @Delete(':id/hard')
  async hardDelete(@Param('id', ParseIntPipe) id: number) {
    return await this.reportesPlantillerosService.hardDelete(id);
  }
}