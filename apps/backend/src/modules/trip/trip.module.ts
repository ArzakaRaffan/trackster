import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TripController } from './trip.controller';
import { TripService } from './trip.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, ThrottlerModule.forRoot([{ name: 'default', ttl: 600_000, limit: 5 }])],
  controllers: [TripController],
  providers: [TripService, PrismaService],
})
export class TripModule {}
