import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiFinanceToolsService } from './ai-finance-tools.service';
import { BudgetModule } from '../budget/budget.module';
import { TransactionModule } from '../transaction/transaction.module';
import { IncomeModule } from '../income/income.module';

@Module({
  imports: [BudgetModule, TransactionModule, IncomeModule],
  providers: [AiService, AiFinanceToolsService],
  exports: [AiService, AiFinanceToolsService],
})
export class AiModule {}
