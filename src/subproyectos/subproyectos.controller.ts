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
import { SubproyectosService } from './subproyectos.service';
import {
  CreateSubproyectoDto,
  UpdateSubproyectoDto,
} from '../dto/subproyectos.dto';

@Controller('subproyectos')
export class SubproyectosController {
  constructor(private readonly subproyectosService: SubproyectosService) {}

  @Post()
  create(@Body() createSubproyectoDto: CreateSubproyectoDto) {
    return this.subproyectosService.create(createSubproyectoDto);
  }

  @Get()
  findAll(@Query('id_proyecto') idProyecto?: string) {
    if (idProyecto) {
      return this.subproyectosService.findByProyecto(parseInt(idProyecto));
    }
    return this.subproyectosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.subproyectosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSubproyectoDto: UpdateSubproyectoDto,
  ) {
    return this.subproyectosService.update(id, updateSubproyectoDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.subproyectosService.remove(id);
  }
}