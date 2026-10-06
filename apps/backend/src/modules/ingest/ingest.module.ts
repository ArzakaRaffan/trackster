import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { ApiTokenModule } from '../api-token/api-token.module';
import { TransactionModule } from '../transaction/transaction.module';
import { IncomeModule } from '../income/income.module';
import { MerchantAliasModule } from '../merchant-alias/merchant-alias.module';
import { BudgetModule } from '../budget/budget.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AiModule } from '../ai/ai.module';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [ApiTokenModule, TransactionModule, IncomeModule, MerchantAliasModule, BudgetModule, TelegramModule, AiModule],
  controllers: [IngestController],
  providers: [IngestService, PrismaService],
})
export class IngestModule {}
