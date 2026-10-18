import { Module, forwardRef } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { BackupMonitorService } from './backup-monitor.service';

@Module({
  imports: [forwardRef(() => TelegramModule)],
  providers: [BackupMonitorService],
})
export class BackupModule {}
