import { Controller, Get, Param, Query } from '@nestjs/common';
import { ItemsService } from './items.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    if (search) {
      return this.itemsService.search(search);
    }
    return this.itemsService.findAll();
  }

  @Get(':codigo')
  findOne(@Param('codigo') codigo: string) {
    return this.itemsService.findOne(codigo);
  }
}
