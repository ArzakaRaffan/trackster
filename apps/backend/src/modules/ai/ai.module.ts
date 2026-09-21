import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiFinanceToolsService } from './ai-finance-tools.service';
import { AiChatService } from './ai-chat.service';
import { AiReportsService } from './ai-reports.service';
import { AiMascotService } from './ai-mascot.service';
import { AiController } from './ai.controller';
import { BudgetModule } from '../budget/budget.module';
import { TransactionModule } from '../transaction/transaction.module';
import { IncomeModule } from '../income/income.module';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [
    BudgetModule,
    TransactionModule,
    IncomeModule,
    AuthModule,
    forwardRef(() => TelegramModule),
  ],
  providers: [AiService, AiFinanceToolsService, AiChatService, AiReportsService, AiMascotService, PrismaService],
  controllers: [AiController],
  exports: [AiService, AiFinanceToolsService, AiChatService, AiReportsService, AiMascotService],
})
export class AiModule {}
