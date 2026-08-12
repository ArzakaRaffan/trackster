import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { BudgetModule } from './modules/budget/budget.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { GmailModule } from './modules/gmail/gmail.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { SyncModule } from './modules/sync/sync.module';

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
  ],
})
export class AppModule {}
