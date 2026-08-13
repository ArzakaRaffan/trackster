import { BadRequestException, Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { CorrectBalanceDto } from './dto/correct-balance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Source } from '@prisma/client';

function parseSource(value: string): Source {
  if (!Object.values(Source).includes(value as Source)) {
    throw new BadRequestException(`Source tidak valid: ${value}`);
  }
  return value as Source;
}

@UseGuards(JwtAuthGuard)
@Controller('balance')
export class BalanceController {
  constructor(private balanceService: BalanceService) {}

  @Get()
  async getAll() {
    return this.balanceService.getAll();
  }

  @Put(':source')
  async correctBalance(@Param('source') source: string, @Body() dto: CorrectBalanceDto) {
    return this.balanceService.correctBalance(parseSource(source), dto.newBalance, dto.note);
  }

  @Get(':source/adjustments')
  async getAdjustments(@Param('source') source: string) {
    return this.balanceService.getAdjustments(parseSource(source));
  }
}
