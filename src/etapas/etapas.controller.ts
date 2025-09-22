import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { EtapasService } from './etapas.service';
import {
  CreateEtapaDto,
  UpdateEtapaDto,
} from '../dto/etapas.dto';

@Controller('etapas')
export class EtapasController {
  constructor(private readonly etapasService: EtapasService) {}

  @Post()
  create(@Body() createEtapaDto: CreateEtapaDto) {
    return this.etapasService.create(createEtapaDto);
  }

  @Get()
  findAll(@Query('id_proyecto') idProyecto?: string) {
    if (idProyecto) {
      return this.etapasService.findByProyecto(parseInt(idProyecto));
    }
    return this.etapasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.etapasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEtapaDto: UpdateEtapaDto,
  ) {
    return this.etapasService.update(id, updateEtapaDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.etapasService.remove(id);
  }
}