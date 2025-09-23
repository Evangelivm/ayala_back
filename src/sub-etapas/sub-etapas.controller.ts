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
import { SubEtapasService } from './sub-etapas.service';
import {
  CreateSubEtapaDto,
  UpdateSubEtapaDto,
} from '../dto/sub-etapas.dto';

@Controller('sub-etapas')
export class SubEtapasController {
  constructor(private readonly subEtapasService: SubEtapasService) {}

  @Post()
  create(@Body() createSubEtapaDto: CreateSubEtapaDto) {
    return this.subEtapasService.create(createSubEtapaDto);
  }

  @Get()
  findAll(@Query('id_subproyecto') idSubproyecto?: string) {
    if (idSubproyecto) {
      return this.subEtapasService.findBySubproyecto(parseInt(idSubproyecto));
    }
    return this.subEtapasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.subEtapasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSubEtapaDto: UpdateSubEtapaDto,
  ) {
    return this.subEtapasService.update(id, updateSubEtapaDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.subEtapasService.remove(id);
  }
}