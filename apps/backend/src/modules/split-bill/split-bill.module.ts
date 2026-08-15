import { Module } from '@nestjs/common';
import { SplitBillController } from './split-bill.controller';
import { SplitBillService } from './split-bill.service';
import { SplitBillAiService } from './split-bill-ai.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SplitBillController],
  providers: [SplitBillService, SplitBillAiService, PrismaService],
})
export class SplitBillModule {}
