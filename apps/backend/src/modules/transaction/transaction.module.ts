import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { BalanceModule } from '../balance/balance.module';
import { MerchantAliasModule } from '../merchant-alias/merchant-alias.module';

@Module({
  imports: [AuthModule, BalanceModule, MerchantAliasModule],
  controllers: [TransactionController],
  providers: [TransactionService, PrismaService],
  exports: [TransactionService],
})
export class TransactionModule {}
