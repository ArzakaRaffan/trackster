import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HabitService } from './habit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('habits')
export class HabitController {
  constructor(private habitService: HabitService) {}

  /** Kebiasaan minggu yang memuat `week` ('YYYY-MM-DD', default minggu ini). */
  @Get()
  async getWeekly(@CurrentUser() user: AuthUser, @Query('week') week?: string) {
    if (week && !/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new BadRequestException('week harus YYYY-MM-DD');
    return this.habitService.getWeekly(user.id, week);
  }
}
