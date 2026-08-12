import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { PrismaService } from '../../prisma.service';
import { GmailModule } from '../gmail/gmail.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, GmailModule],
  controllers: [SyncController],
  providers: [PrismaService],
})
export class SyncModule {}
