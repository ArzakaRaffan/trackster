import { Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramService } from './telegram.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TelegramController, TelegramWebhookController],
  providers: [TelegramService, PrismaService],
  exports: [TelegramService],
})
export class TelegramModule {}
