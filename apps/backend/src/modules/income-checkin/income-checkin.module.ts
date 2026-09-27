import { Module, forwardRef } from '@nestjs/common';
import { IncomeCheckinController } from './income-checkin.controller';
import { IncomeCheckinService } from './income-checkin.service';
import { IncomeCheckinCronService } from './income-checkin-cron.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { BalanceModule } from '../balance/balance.module';
import { IncomeForecastModule } from '../income-forecast/income-forecast.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [AuthModule, BalanceModule, IncomeForecastModule, forwardRef(() => TelegramModule)],
  controllers: [IncomeCheckinController],
  providers: [IncomeCheckinService, IncomeCheckinCronService, PrismaService],
  exports: [IncomeCheckinService, IncomeCheckinCronService],
})
export class IncomeCheckinModule {}
