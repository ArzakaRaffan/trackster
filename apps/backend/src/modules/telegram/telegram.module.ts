import { Module, forwardRef } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramService } from './telegram.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AuthModule, forwardRef(() => AiModule)],
  controllers: [TelegramController, TelegramWebhookController],
  providers: [TelegramService, PrismaService],
  exports: [TelegramService],
})
export class TelegramModule {}
