import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiFinanceToolsService } from './ai-finance-tools.service';
import { AiChatService } from './ai-chat.service';
import { AiReportsService } from './ai-reports.service';
import { AiMascotService } from './ai-mascot.service';
import { AiCaptionService } from './ai-caption.service';
import { AiAnomalyService } from './ai-anomaly.service';
import { FinancialSnapshotService } from './financial-snapshot.service';
import { AiMemoryService } from './ai-memory.service';
import { RetrievalService } from './retrieval.service';
import { AiController } from './ai.controller';
import { BudgetModule } from '../budget/budget.module';
import { TransactionModule } from '../transaction/transaction.module';
import { IncomeModule } from '../income/income.module';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { GoalModule } from '../goal/goal.module';
import { BalanceModule } from '../balance/balance.module';
import { IncomeForecastModule } from '../income-forecast/income-forecast.module';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [
    BudgetModule,
    TransactionModule,
    IncomeModule,
    AuthModule,
    GoalModule,
    BalanceModule,
    IncomeForecastModule,
    forwardRef(() => SubscriptionModule),
    forwardRef(() => TelegramModule),
  ],
  providers: [
    AiService,
    AiFinanceToolsService,
    AiChatService,
    AiReportsService,
    AiMascotService,
    AiCaptionService,
    AiAnomalyService,
    FinancialSnapshotService,
    AiMemoryService,
    RetrievalService,
    PrismaService,
  ],
  controllers: [AiController],
  exports: [
    AiService,
    AiFinanceToolsService,
    AiChatService,
    AiReportsService,
    AiMascotService,
    AiCaptionService,
    AiAnomalyService,
    FinancialSnapshotService,
    AiMemoryService,
    RetrievalService,
  ],
})
export class AiModule {}