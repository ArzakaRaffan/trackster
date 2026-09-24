import { Module } from '@nestjs/common';
import { IncomeStreamController } from './income-stream.controller';
import { IncomeStreamService } from './income-stream.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [IncomeStreamController],
  providers: [IncomeStreamService, PrismaService],
  exports: [IncomeStreamService],
})
export class IncomeStreamModule {}
