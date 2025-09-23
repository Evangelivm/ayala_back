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
import { SubpartidasService } from './subpartidas.service';
import {
  CreateSubpartidaDto,
  UpdateSubpartidaDto,
} from '../dto/subpartidas.dto';

@Controller('subpartidas')
export class SubpartidasController {
  constructor(private readonly subpartidasService: SubpartidasService) {}

  @Post()
  create(@Body() createSubpartidaDto: CreateSubpartidaDto) {
    return this.subpartidasService.create(createSubpartidaDto);
  }

  @Get()
  findAll(@Query('id_subfrente') idSubfrente?: string) {
    if (idSubfrente) {
      return this.subpartidasService.findBySubfrente(parseInt(idSubfrente));
    }
    return this.subpartidasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.subpartidasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSubpartidaDto: UpdateSubpartidaDto,
  ) {
    return this.subpartidasService.update(id, updateSubpartidaDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.subpartidasService.remove(id);
  }
}