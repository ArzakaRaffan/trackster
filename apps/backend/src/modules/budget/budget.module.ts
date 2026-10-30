import { Module } from '@nestjs/common';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { AuthModule } from '../auth/auth.module';
import { MerchantAliasModule } from '../merchant-alias/merchant-alias.module';

@Module({
  imports: [AuthModule, MerchantAliasModule],
  controllers: [BudgetController],
  providers: [BudgetService],
  exports: [BudgetService],
})
export class BudgetModule {}
