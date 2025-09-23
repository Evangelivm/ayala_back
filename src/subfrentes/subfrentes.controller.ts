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
import { SubfrentesService } from './subfrentes.service';
import {
  CreateSubfrenteDto,
  UpdateSubfrenteDto,
} from '../dto/subfrentes.dto';

@Controller('subfrentes')
export class SubfrentesController {
  constructor(private readonly subfrentesService: SubfrentesService) {}

  @Post()
  create(@Body() createSubfrenteDto: CreateSubfrenteDto) {
    return this.subfrentesService.create(createSubfrenteDto);
  }

  @Get()
  findAll(@Query('id_subsector') idSubsector?: string) {
    if (idSubsector) {
      return this.subfrentesService.findBySubsector(parseInt(idSubsector));
    }
    return this.subfrentesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.subfrentesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSubfrenteDto: UpdateSubfrenteDto,
  ) {
    return this.subfrentesService.update(id, updateSubfrenteDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.subfrentesService.remove(id);
  }
}