import { Module } from '@nestjs/common';
import { InboundController } from './inbound.controller';
import { InboundService } from './inbound.service';
import { GmailModule } from '../gmail/gmail.module';
import { TelegramModule } from '../telegram/telegram.module';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [GmailModule, TelegramModule],
  controllers: [InboundController],
  providers: [InboundService, PrismaService],
})
export class InboundModule {}
