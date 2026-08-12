import { Module } from '@nestjs/common';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BudgetController],
  providers: [BudgetService, PrismaService],
  exports: [BudgetService],
})
export class BudgetModule {}
