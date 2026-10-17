import { Module } from '@nestjs/common';
import { InboundController } from './inbound.controller';
import { InboundService } from './inbound.service';
import { GmailModule } from '../gmail/gmail.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [GmailModule, TelegramModule],
  controllers: [InboundController],
  providers: [InboundService],
})
export class InboundModule {}
