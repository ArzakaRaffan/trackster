import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GoalService } from './goal.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { ContributeGoalDto } from './dto/contribute-goal.dto';
import { SimulateGoalDto } from './dto/simulate-goal.dto';

@UseGuards(JwtAuthGuard)
@Controller('goal')
export class GoalController {
  constructor(private goalService: GoalService) {}

  @Get()
  findAll() {
    return this.goalService.findAll();
  }

  @Post()
  create(@Body() dto: CreateGoalDto) {
    return this.goalService.create(dto);
  }

  @Post(':id/contribute')
  contribute(@Param('id', ParseIntPipe) id: number, @Body() dto: ContributeGoalDto) {
    return this.goalService.contribute(id, dto);
  }

  @Patch(':id/archive')
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.goalService.archive(id);
  }

  @Post(':id/simulate')
  simulate(@Param('id', ParseIntPipe) id: number, @Body() dto: SimulateGoalDto) {
    return this.goalService.simulate(id, dto.cutPercent);
  }
}
