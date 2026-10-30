import { Module, forwardRef } from '@nestjs/common';
import { IncomeController } from './income.controller';
import { IncomeService } from './income.service';
import { AuthModule } from '../auth/auth.module';
import { BalanceModule } from '../balance/balance.module';
import { BudgetModule } from '../budget/budget.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [AuthModule, BalanceModule, BudgetModule, forwardRef(() => TelegramModule)],
  controllers: [IncomeController],
  providers: [IncomeService],
  exports: [IncomeService],
})
export class IncomeModule {}
