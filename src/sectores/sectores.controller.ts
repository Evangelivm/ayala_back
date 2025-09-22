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
import { SectoresService } from './sectores.service';
import {
  CreateSectorDto,
  UpdateSectorDto,
} from '../dto/sectores.dto';

@Controller('sectores')
export class SectoresController {
  constructor(private readonly sectoresService: SectoresService) {}

  @Post()
  create(@Body() createSectorDto: CreateSectorDto) {
    return this.sectoresService.create(createSectorDto);
  }

  @Get()
  findAll(@Query('id_etapa') idEtapa?: string) {
    if (idEtapa) {
      return this.sectoresService.findByEtapa(parseInt(idEtapa));
    }
    return this.sectoresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sectoresService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSectorDto: UpdateSectorDto,
  ) {
    return this.sectoresService.update(id, updateSectorDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sectoresService.remove(id);
  }
}