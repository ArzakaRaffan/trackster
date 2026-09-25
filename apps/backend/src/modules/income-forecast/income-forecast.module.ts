import { Module } from '@nestjs/common';
import { IncomeForecastController } from './income-forecast.controller';
import { IncomeForecastService } from './income-forecast.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [IncomeForecastController],
  providers: [IncomeForecastService, PrismaService],
  exports: [IncomeForecastService],
})
export class IncomeForecastModule {}
