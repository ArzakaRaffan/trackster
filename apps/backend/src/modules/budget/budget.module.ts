import { Module } from '@nestjs/common';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { BudgetAdvisorService } from './budget-advisor.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { MerchantAliasModule } from '../merchant-alias/merchant-alias.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { IncomeForecastModule } from '../income-forecast/income-forecast.module';

@Module({
  imports: [AuthModule, MerchantAliasModule, AnalyticsModule, IncomeForecastModule],
  controllers: [BudgetController],
  providers: [BudgetService, BudgetAdvisorService, PrismaService],
  exports: [BudgetService],
})
export class BudgetModule {}
