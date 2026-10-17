import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { GmailModule } from '../gmail/gmail.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, GmailModule],
  controllers: [SyncController],
  providers: [],
})
export class SyncModule {}
