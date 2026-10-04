import { Module } from '@nestjs/common';
import { ReimbursementController } from './reimbursement.controller';
import { ReimbursementService } from './reimbursement.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [AuthModule, BalanceModule],
  controllers: [ReimbursementController],
  providers: [ReimbursementService, PrismaService],
})
export class ReimbursementModule {}
