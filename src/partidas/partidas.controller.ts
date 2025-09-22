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
import { PartidasService } from './partidas.service';
import {
  CreatePartidaDto,
  UpdatePartidaDto,
} from '../dto/partidas.dto';

@Controller('partidas')
export class PartidasController {
  constructor(private readonly partidasService: PartidasService) {}

  @Post()
  create(@Body() createPartidaDto: CreatePartidaDto) {
    return this.partidasService.create(createPartidaDto);
  }

  @Get()
  findAll(@Query('id_frente') idFrente?: string) {
    if (idFrente) {
      return this.partidasService.findByFrente(parseInt(idFrente));
    }
    return this.partidasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.partidasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePartidaDto: UpdatePartidaDto,
  ) {
    return this.partidasService.update(id, updatePartidaDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.partidasService.remove(id);
  }
}