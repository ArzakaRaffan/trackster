import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { getOwnerUserId } from '../../common/owner';

const MAX_AGE_MS = 26 * 3600_000; // backup harian ±03:00 WIB + jeda coba ulang

/** Pesan peringatan, atau null kalau backup harian terbaru masih segar. Murni (lihat backup-monitor.check.ts). */
export function backupAlert(files: { name: string; mtimeMs: number }[], now = Date.now()): string | null {
  const daily = files.filter((f) => /^trackster-daily-.*\.dump$/.test(f.name)).sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  if (!daily) return '⚠️ <b>Backup DB</b>: belum ada backup harian sama sekali. Cek: <code>docker compose -f docker-compose.prod.yml logs db-backup</code>';
  const hours = Math.floor((now - daily.mtimeMs) / 3600_000);
  if (now - daily.mtimeMs <= MAX_AGE_MS) return null;
  return `⚠️ <b>Backup DB</b>: backup harian terakhir ${hours} jam lalu (${daily.name}). Cek: <code>docker compose -f docker-compose.prod.yml logs db-backup</code>`;
}

/** Volume backup di-mount read-only ke backend (`/backups`, docker-compose.prod.yml). Tanpa folder itu (dev) → diam. */
@Injectable()
export class BackupMonitorService {
  private readonly logger = new Logger(BackupMonitorService.name);
  private readonly dir = process.env.BACKUP_DIR || '/backups';

  constructor(private prisma: PrismaService, private telegramService: TelegramService) {}

  @Cron('0 9 * * *', { name: 'backup-monitor', timeZone: 'Asia/Jakarta' })
  async check() {
    const names = await readdir(this.dir).catch(() => null);
    if (!names) return;
    const files = await Promise.all(names.map(async (name) => ({ name, mtimeMs: (await stat(join(this.dir, name))).mtimeMs })));
    const alert = backupAlert(files);
    if (!alert) return;
    this.logger.warn(alert.replace(/<[^>]+>/g, ''));
    await this.telegramService.sendMessage(await getOwnerUserId(this.prisma), alert);
  }
}
