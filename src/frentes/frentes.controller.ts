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
import { FrentesService } from './frentes.service';
import {
  CreateFrenteDto,
  UpdateFrenteDto,
} from '../dto/frentes.dto';

@Controller('frentes')
export class FrentesController {
  constructor(private readonly frentesService: FrentesService) {}

  @Post()
  create(@Body() createFrenteDto: CreateFrenteDto) {
    return this.frentesService.create(createFrenteDto);
  }

  @Get()
  findAll(@Query('id_sector') idSector?: string) {
    if (idSector) {
      return this.frentesService.findBySector(parseInt(idSector));
    }
    return this.frentesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.frentesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFrenteDto: UpdateFrenteDto,
  ) {
    return this.frentesService.update(id, updateFrenteDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.frentesService.remove(id);
  }
}