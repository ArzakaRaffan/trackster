import { Module, forwardRef } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramService } from './telegram.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { IncomeCheckinModule } from '../income-checkin/income-checkin.module';
import { IngestModule } from '../ingest/ingest.module';

@Module({
  imports: [AuthModule, forwardRef(() => AiModule), forwardRef(() => IncomeCheckinModule), forwardRef(() => IngestModule)],
  controllers: [TelegramController, TelegramWebhookController],
  providers: [TelegramService, PrismaService],
  exports: [TelegramService],
})
export class TelegramModule {}
