import { Module, forwardRef } from '@nestjs/common';
import { GmailController } from './gmail.controller';
import { GmailAuthService } from './gmail-auth.service';
import { GmailSyncService } from './gmail-sync.service';
import { ParserRegistryService } from './parsers/parser-registry.service';
import { BcaParser } from './parsers/bca.parser';
import { JagoParser } from './parsers/jago.parser';
import { FlipParser } from './parsers/flip.parser';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { TransactionModule } from '../transaction/transaction.module';
import { BudgetModule } from '../budget/budget.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AiModule } from '../ai/ai.module';
import { MerchantAliasModule } from '../merchant-alias/merchant-alias.module';
import { IncomeModule } from '../income/income.module';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [
    AuthModule,
    TransactionModule,
    BudgetModule,
    TelegramModule,
    MerchantAliasModule,
    IncomeModule,
    BalanceModule,
    forwardRef(() => AiModule),
  ],
  controllers: [GmailController],
  providers: [
    GmailAuthService,
    GmailSyncService,
    ParserRegistryService,
    BcaParser,
    JagoParser,
    FlipParser,
    PrismaService,
  ],
  exports: [GmailSyncService, GmailAuthService],
})
export class GmailModule {}
