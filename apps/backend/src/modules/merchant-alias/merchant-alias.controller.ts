import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { MerchantAliasService } from './merchant-alias.service';
import { UpsertMerchantAliasDto } from './dto/upsert-merchant-alias.dto';
import { UpdateMerchantAliasDto } from './dto/update-merchant-alias.dto';
import { SetCategoryIconDto, SetMerchantIconDto } from './dto/set-icon.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('merchant-aliases')
export class MerchantAliasController {
  constructor(private merchantAliasService: MerchantAliasService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    return this.merchantAliasService.findAll(user.id);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: UpsertMerchantAliasDto) {
    return this.merchantAliasService.upsert(user.id, dto.rawDescription, dto.displayName);
  }

  // Route statis harus sebelum ':id' (ParseIntPipe).
  @Put('icon')
  async setIcon(@CurrentUser() user: AuthUser, @Body() dto: SetMerchantIconDto) {
    return this.merchantAliasService.setIcon(user.id, dto.rawDescription, dto.icon ?? null);
  }

  @Get('category-icons')
  async categoryIcons(@CurrentUser() user: AuthUser) {
    return this.merchantAliasService.findCategoryIcons(user.id);
  }

  @Put('category-icons')
  async setCategoryIcon(@CurrentUser() user: AuthUser, @Body() dto: SetCategoryIconDto) {
    await this.merchantAliasService.setCategoryIcon(user.id, dto.category, dto.icon ?? null);
    return this.merchantAliasService.findCategoryIcons(user.id);
  }

  @Put(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMerchantAliasDto) {
    return this.merchantAliasService.update(user.id, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.merchantAliasService.remove(user.id, id);
  }
}
