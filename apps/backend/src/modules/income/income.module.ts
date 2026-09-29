import { Module, forwardRef } from '@nestjs/common';
import { IncomeController } from './income.controller';
import { IncomeService } from './income.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { BalanceModule } from '../balance/balance.module';
import { IncomeForecastModule } from '../income-forecast/income-forecast.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [AuthModule, BalanceModule, IncomeForecastModule, forwardRef(() => TelegramModule)],
  controllers: [IncomeController],
  providers: [IncomeService, PrismaService],
  exports: [IncomeService],
})
export class IncomeModule {}
