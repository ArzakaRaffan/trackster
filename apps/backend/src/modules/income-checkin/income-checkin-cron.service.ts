import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IncomeKind } from '@prisma/client';
import { IncomeCheckinService } from './income-checkin.service';
import { TelegramService } from '../telegram/telegram.service';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

const KIND_LABEL: Record<IncomeKind, string> = {
  FIXED: 'Tetap',
  SESSION: 'Per sesi',
  DEDUCTION: 'Potongan absen',
  VARIABLE: 'Bulanan',
  IRREGULAR: 'Tak tentu',
};

/** Callback data Telegram dibatasi 64 byte — format singkat `ci:<action>:<streamId>:<weekStart>[:<value>]`.
 *  weekStart 'YYYY-MM-DD' (10 char) + prefix pendek supaya selalu muat. */
export function encodeCallback(action: 'confirm' | 'absent', streamId: number, weekStart: string, value?: number): string {
  return value === undefined ? `ci:${action}:${streamId}:${weekStart}` : `ci:${action}:${streamId}:${weekStart}:${value}`;
}

export function decodeCallback(data: string): { action: 'confirm' | 'absent'; streamId: number; weekStart: string; value?: number } | null {
  const parts = data.split(':');
  if (parts[0] !== 'ci') return null;
  const [, action, streamIdStr, weekStart, valueStr] = parts;
  if (action !== 'confirm' && action !== 'absent') return null;
  const streamId = Number(streamIdStr);
  if (!Number.isFinite(streamId)) return null;
  return { action, streamId, weekStart, value: valueStr !== undefined ? Number(valueStr) : undefined };
}

@Injectable()
export class IncomeCheckinCronService {
  private readonly logger = new Logger(IncomeCheckinCronService.name);

  constructor(
    private incomeCheckinService: IncomeCheckinService,
    private telegramService: TelegramService,
  ) {}

  /** Minggu 19:00 WIB — sebelum weekly report (20:00, `ai-reports.service.ts`). */
  @Cron('0 19 * * 0', { name: 'income-checkin-prompt', timeZone: 'Asia/Jakarta' })
  async sendWeeklyPrompt() {
    this.logger.log('Mengirim check-in pemasukan mingguan...');
    try {
      await this.sendPromptIfPending();
    } catch (err: any) {
      this.logger.error(`sendWeeklyPrompt error: ${err?.message}`);
    }
  }

  /** Senin 12:00 WIB — reminder sekali kalau masih ada yang belum diisi dari prompt Minggu malam. */
  @Cron('0 12 * * 1', { name: 'income-checkin-reminder', timeZone: 'Asia/Jakarta' })
  async sendReminderIfPending() {
    this.logger.log('Cek reminder check-in pemasukan (Senin siang)...');
    try {
      await this.sendPromptIfPending();
    } catch (err: any) {
      this.logger.error(`sendReminderIfPending error: ${err?.message}`);
    }
  }

  private async sendPromptIfPending() {
    const draft = await this.incomeCheckinService.getDraft();
    const pending = draft.streams.filter((s) => !s.recorded);
    if (pending.length === 0) {
      this.logger.log('Semua stream sudah tercatat minggu ini — skip prompt.');
      return;
    }

    const lines: string[] = [
      `💰 <b>Check-in pemasukan minggu ini</b> (${formatDateLabel(draft.weekStart)}–${formatDateLabel(draft.weekEnd)})`,
      '',
    ];
    const keyboard: { text: string; callback_data?: string; url?: string }[][] = [];

    for (const s of draft.streams) {
      if (s.recorded) {
        lines.push(`✓ ${s.name} ${formatRupiah(s.recordedAmount)} — sudah masuk`);
        continue;
      }
      lines.push(`• ${s.name} (${KIND_LABEL[s.kind]}) — perkiraan ${formatRupiah(s.expected)}`);
      if (s.kind === 'FIXED') {
        keyboard.push([{ text: `✓ ${s.name} sudah masuk`, callback_data: encodeCallback('confirm', s.id, draft.weekStart) }]);
      } else if (s.kind === 'DEDUCTION') {
        keyboard.push(
          [0, 1, 2, 3].map((n) => ({
            text: n === 3 ? '3+ absen' : `${n} absen`,
            callback_data: encodeCallback('absent', s.id, draft.weekStart, n),
          })),
        );
      }
      // SESSION & VARIABLE: cuma link web (nominal butuh input lebih dari satu angka).
    }

    lines.push('', `Perkiraan: ${formatRupiah(draft.totalExpected)} · Tercatat: ${formatRupiah(draft.totalRecorded)}`);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    keyboard.push([{ text: '📝 Isi lengkap di web', url: `${frontendUrl}/app/income/checkin?week=${draft.weekStart}` }]);

    await this.telegramService.sendMessageWithKeyboard(lines.join('\n'), keyboard as any);
  }

  /** Dipanggil dari `TelegramWebhookController` saat ada `callback_query` dengan prefix `ci:`. */
  async handleCallback(data: string): Promise<string> {
    const decoded = decodeCallback(data);
    if (!decoded) return 'Tombol tidak dikenali.';

    if (decoded.action === 'confirm') {
      const created = await this.incomeCheckinService.submit(decoded.weekStart, [{ streamId: decoded.streamId }]);
      return created.length > 0 ? '✅ Tercatat!' : 'Sudah tercatat sebelumnya.';
    }

    // absent: value = jumlah hari absen (0-3, 3 dianggap "3+" — kalau lebih, koreksi via web)
    const created = await this.incomeCheckinService.submit(decoded.weekStart, [{ streamId: decoded.streamId, units: decoded.value ?? 0 }]);
    return created.length > 0 ? `✅ Tercatat (${decoded.value ?? 0} hari absen)!` : 'Sudah tercatat sebelumnya.';
  }
}

function formatDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${Number(day)}/${Number(month)}`;
}
