import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { MerchantAliasService } from './merchant-alias.service';
import { UpsertMerchantAliasDto } from './dto/upsert-merchant-alias.dto';
import { UpdateMerchantAliasDto } from './dto/update-merchant-alias.dto';
import { SetCategoryIconDto, SetMerchantIconDto } from './dto/set-icon.dto';
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

  // Route statis harus sebelum ':id' (ParseIntPipe).
  @Put('icon')
  async setIcon(@Body() dto: SetMerchantIconDto) {
    return this.merchantAliasService.setIcon(dto.rawDescription, dto.icon ?? null);
  }

  @Get('category-icons')
  async categoryIcons() {
    return this.merchantAliasService.findCategoryIcons();
  }

  @Put('category-icons')
  async setCategoryIcon(@Body() dto: SetCategoryIconDto) {
    await this.merchantAliasService.setCategoryIcon(dto.category, dto.icon ?? null);
    return this.merchantAliasService.findCategoryIcons();
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMerchantAliasDto) {
    return this.merchantAliasService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.merchantAliasService.remove(id);
  }
}
