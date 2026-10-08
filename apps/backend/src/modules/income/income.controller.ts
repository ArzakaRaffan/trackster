import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IncomeStatus } from '@prisma/client';
import { IncomeService } from './income.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { ResolveIncomeDto } from './dto/resolve-income.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('income')
export class IncomeController {
  constructor(private incomeService: IncomeService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: IncomeStatus,
  ) {
    return this.incomeService.findAll(user.id, { startDate, endDate, status });
  }


  @UseGuards(JwtAuthGuard)
  @Get('allocation')
  async getAllocation(@CurrentUser() user: AuthUser) {
    return this.incomeService.getAllocationRecommendation(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateIncomeDto) {
    return this.incomeService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIncomeDto) {
    return this.incomeService.update(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.incomeService.remove(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/resolve')
  async resolve(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ResolveIncomeDto) {
    return this.incomeService.resolve(user.id, id, dto);
  }
}
