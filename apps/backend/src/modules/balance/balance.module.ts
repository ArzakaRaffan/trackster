import { Module } from '@nestjs/common';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BalanceController],
  providers: [BalanceService, PrismaService],
  exports: [BalanceService],
})
export class BalanceModule {}
