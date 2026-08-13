import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { BudgetModule } from './modules/budget/budget.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { GmailModule } from './modules/gmail/gmail.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { SyncModule } from './modules/sync/sync.module';
import { BalanceModule } from './modules/balance/balance.module';
import { IncomeModule } from './modules/income/income.module';
import { MerchantAliasModule } from './modules/merchant-alias/merchant-alias.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    BudgetModule,
    TransactionModule,
    GmailModule,
    TelegramModule,
    SyncModule,
    BalanceModule,
    IncomeModule,
    MerchantAliasModule,
  ],
})
export class AppModule {}
