import { Module } from '@nestjs/common';
import { HabitController } from './habit.controller';
import { HabitService } from './habit.service';
import { AuthModule } from '../auth/auth.module';
import { BudgetModule } from '../budget/budget.module';
import { MerchantAliasModule } from '../merchant-alias/merchant-alias.module';

@Module({
  imports: [AuthModule, BudgetModule, MerchantAliasModule],
  controllers: [HabitController],
  providers: [HabitService],
  exports: [HabitService],
})
export class HabitModule {}
