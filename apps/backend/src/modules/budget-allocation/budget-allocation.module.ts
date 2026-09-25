import { Module } from '@nestjs/common';
import { BudgetAllocationController } from './budget-allocation.controller';
import { BudgetAllocationService } from './budget-allocation.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { BudgetModule } from '../budget/budget.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [AuthModule, BudgetModule, TelegramModule],
  controllers: [BudgetAllocationController],
  providers: [BudgetAllocationService, PrismaService],
  exports: [BudgetAllocationService],
})
export class BudgetAllocationModule {}
