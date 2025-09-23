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
import { SubsectoresService } from './subsectores.service';
import {
  CreateSubsectorDto,
  UpdateSubsectorDto,
} from '../dto/subsectores.dto';

@Controller('subsectores')
export class SubsectoresController {
  constructor(private readonly subsectoresService: SubsectoresService) {}

  @Post()
  create(@Body() createSubsectorDto: CreateSubsectorDto) {
    return this.subsectoresService.create(createSubsectorDto);
  }

  @Get()
  findAll(@Query('id_sub_etapa') idSubEtapa?: string) {
    if (idSubEtapa) {
      return this.subsectoresService.findBySubEtapa(parseInt(idSubEtapa));
    }
    return this.subsectoresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.subsectoresService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSubsectorDto: UpdateSubsectorDto,
  ) {
    return this.subsectoresService.update(id, updateSubsectorDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.subsectoresService.remove(id);
  }
}