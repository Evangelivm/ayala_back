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
import { ReportesOperadoresService } from '../services/reportes-operadores.service';
import {
  ReportesOperadoresDto,
  UpdateReportesOperadoresDto,
  ReportesOperadoresFilterDto,
  ReportesOperadoresSchema,
  UpdateReportesOperadoresSchema,
  ReportesOperadoresFilterSchema,
} from '../dto/reportes-operadores.dto';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

@Controller('reportes-operadores')
export class ReportesOperadoresController {
  constructor(private readonly reportesOperadoresService: ReportesOperadoresService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(ReportesOperadoresSchema))
  async create(@Body() createReportesOperadoresDto: ReportesOperadoresDto) {
    try {
      return await this.reportesOperadoresService.create(createReportesOperadoresDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  async findAll(@Query() query: any) {
    try {
      // Validar y parsear filtros
      const filters = ReportesOperadoresFilterSchema.parse({
        ...query,
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 10,
        id_proyecto: query.id_proyecto ? parseInt(query.id_proyecto) : undefined,
        activo: query.activo !== undefined ? query.activo === 'true' : undefined,
      });

      return await this.reportesOperadoresService.findAll(filters);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.reportesOperadoresService.findOne(id);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateReportesOperadoresSchema))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateReportesOperadoresDto: UpdateReportesOperadoresDto,
  ) {
    try {
      return await this.reportesOperadoresService.update(id, updateReportesOperadoresDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.reportesOperadoresService.remove(id);
  }

  @Delete(':id/hard')
  async hardDelete(@Param('id', ParseIntPipe) id: number) {
    return await this.reportesOperadoresService.hardDelete(id);
  }
}