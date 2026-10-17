import { Module, forwardRef } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { TelegramQuickService } from './telegram-quick.service';
import { ApiTokenModule } from '../api-token/api-token.module';
import { TransactionModule } from '../transaction/transaction.module';
import { IncomeModule } from '../income/income.module';
import { MerchantAliasModule } from '../merchant-alias/merchant-alias.module';
import { BudgetModule } from '../budget/budget.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [ApiTokenModule, TransactionModule, IncomeModule, MerchantAliasModule, BudgetModule, forwardRef(() => TelegramModule), AiModule],
  controllers: [IngestController],
  providers: [IngestService, TelegramQuickService],
  exports: [TelegramQuickService],
})
export class IngestModule {}
