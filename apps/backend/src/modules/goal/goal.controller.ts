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
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { GoalService } from './goal.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { ContributeGoalDto } from './dto/contribute-goal.dto';
import { SimulateGoalDto } from './dto/simulate-goal.dto';

@UseGuards(JwtAuthGuard)
@Controller('goal')
export class GoalController {
  constructor(private goalService: GoalService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.goalService.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGoalDto) {
    return this.goalService.create(user.id, dto);
  }

  @Post(':id/contribute')
  contribute(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ContributeGoalDto) {
    return this.goalService.contribute(user.id, id, dto);
  }

  @Patch(':id/archive')
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.goalService.archive(user.id, id);
  }

  @Post(':id/simulate')
  simulate(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: SimulateGoalDto) {
    return this.goalService.simulate(user.id, id, dto.cutPercent);
  }
}
