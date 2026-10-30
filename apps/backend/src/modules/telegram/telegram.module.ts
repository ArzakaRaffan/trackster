import { Module, forwardRef } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramService } from './telegram.service';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { IngestModule } from '../ingest/ingest.module';

@Module({
  imports: [AuthModule, forwardRef(() => AiModule), forwardRef(() => IngestModule)],
  controllers: [TelegramController, TelegramWebhookController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
