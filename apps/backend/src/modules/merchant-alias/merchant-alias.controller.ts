import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { MerchantAliasService } from './merchant-alias.service';
import { UpsertMerchantAliasDto } from './dto/upsert-merchant-alias.dto';
import { UpdateMerchantAliasDto } from './dto/update-merchant-alias.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('merchant-aliases')
export class MerchantAliasController {
  constructor(private merchantAliasService: MerchantAliasService) {}

  @Get()
  async findAll() {
    return this.merchantAliasService.findAll();
  }

  @Post()
  async create(@Body() dto: UpsertMerchantAliasDto) {
    return this.merchantAliasService.upsert(dto.rawDescription, dto.displayName);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMerchantAliasDto) {
    return this.merchantAliasService.update(id, dto.displayName);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.merchantAliasService.remove(id);
  }
}
