import { Module } from '@nestjs/common';
import { GmailController } from './gmail.controller';
import { GmailAuthService } from './gmail-auth.service';
import { GmailSyncService } from './gmail-sync.service';
import { ParserRegistryService } from './parsers/parser-registry.service';
import { BcaParser } from './parsers/bca.parser';
import { JagoParser } from './parsers/jago.parser';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { TransactionModule } from '../transaction/transaction.module';
import { BudgetModule } from '../budget/budget.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [AuthModule, TransactionModule, BudgetModule, TelegramModule],
  controllers: [GmailController],
  providers: [
    GmailAuthService,
    GmailSyncService,
    ParserRegistryService,
    BcaParser,
    JagoParser,
    PrismaService,
  ],
  exports: [GmailSyncService, GmailAuthService],
})
export class GmailModule {}
