import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SplitBillController } from './split-bill.controller';
import { SplitBillService } from './split-bill.service';
import { SplitBillAiService } from './split-bill-ai.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  // Rate limit cuma dipakai buat POST /split-bills/public (create anonim) — lihat komentar
  // di controller. In-memory storage cukup buat single-VPS deployment ini, nggak butuh Redis.
  imports: [AuthModule, ThrottlerModule.forRoot([{ name: 'default', ttl: 600_000, limit: 5 }])],
  controllers: [SplitBillController],
  providers: [SplitBillService, SplitBillAiService, PrismaService],
})
export class SplitBillModule {}
