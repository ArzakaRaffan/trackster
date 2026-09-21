import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiFinanceToolsService } from './ai-finance-tools.service';
import { AiChatService } from './ai-chat.service';
import { AiController } from './ai.controller';
import { BudgetModule } from '../budget/budget.module';
import { TransactionModule } from '../transaction/transaction.module';
import { IncomeModule } from '../income/income.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BudgetModule, TransactionModule, IncomeModule, AuthModule],
  providers: [AiService, AiFinanceToolsService, AiChatService],
  controllers: [AiController],
  exports: [AiService, AiFinanceToolsService, AiChatService],
})
export class AiModule {}
