import { Module } from '@nestjs/common';
import { IncomeController } from './income.controller';
import { IncomeService } from './income.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [AuthModule, BalanceModule],
  controllers: [IncomeController],
  providers: [IncomeService, PrismaService],
  exports: [IncomeService],
})
export class IncomeModule {}
