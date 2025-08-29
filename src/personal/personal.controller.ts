import { Controller, Get, Post, Body, Param, Put, Delete, Query, HttpException, HttpStatus } from '@nestjs/common';
import { PersonalService } from './personal.service';
import { CreatePersonalSchema, UpdatePersonalSchema, type CreatePersonalDto, type UpdatePersonalDto } from '../dto/personal.dto';

@Controller('personal')
export class PersonalController {
  constructor(private readonly personalService: PersonalService) {}

  @Get()
  async findAll(@Query('cargo') cargo?: string) {
    if (cargo) {
      return this.personalService.findByCargo(cargo);
    }
    return this.personalService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const personal = await this.personalService.findOne(+id);
    if (!personal) {
      throw new HttpException('Personal no encontrado', HttpStatus.NOT_FOUND);
    }
    return personal;
  }

  @Post()
  async create(@Body() createPersonalDto: CreatePersonalDto) {
    try {
      const validatedData = CreatePersonalSchema.parse(createPersonalDto);
      return this.personalService.create(validatedData);
    } catch (error) {
      throw new HttpException(
        'Datos inválidos: ' + (error as any).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updatePersonalDto: UpdatePersonalDto) {
    try {
      const validatedData = UpdatePersonalSchema.parse(updatePersonalDto);
      return this.personalService.update(+id, validatedData);
    } catch (error) {
      throw new HttpException(
        'Datos inválidos: ' + (error as any).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.personalService.remove(+id);
  }
}