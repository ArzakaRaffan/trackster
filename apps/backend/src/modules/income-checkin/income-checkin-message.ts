import { CheckinDraft } from './income-checkin.service';

export interface CheckinKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

const formatRp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function formatDateLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jakarta',
  });
}

/** Bangun teks + inline keyboard pesan Telegram check-in mingguan — pure function (tidak menyentuh
 * DB/Telegram API), dites di income-checkin.check.ts. FIXED & DEDUCTION dijawab lewat tombol;
 * SESSION/VARIABLE diarahkan ke `checkinUrl`; IRREGULAR sengaja tidak ditampilkan (opsional, cuma
 * ada di halaman web) — lihat catatan E03-income-model.md. */
export function buildCheckinMessage(kind: 'prompt' | 'reminder', draft: CheckinDraft, checkinUrl: string): { text: string; keyboard: CheckinKeyboardButton[][] } {
  const rangeLabel = `${formatDateLabel(draft.weekStart)}–${formatDateLabel(draft.weekEndLabel)}`;
  const title =
    kind === 'prompt'
      ? `💰 <b>Check-in pemasukan minggu ini (${rangeLabel})</b>`
      : `⏰ <b>Belum diisi — check-in pemasukan minggu lalu (${rangeLabel})</b>`;

  const lines: string[] = [title, ''];
  const keyboard: CheckinKeyboardButton[][] = [];

  for (const s of draft.streams) {
    if (s.kind === 'IRREGULAR' || !s.scheduled) continue;

    if (s.alreadyFilled) {
      lines.push(`✓ ${s.name} ${formatRp(s.recordedAmount)} — sudah masuk`);
      continue;
    }

    if (s.kind === 'FIXED') {
      lines.push(`• ${s.name}: belum masuk (${formatRp(s.expected)})`);
      keyboard.push([{ text: `✅ ${s.name} sudah masuk`, callback_data: `ci:${s.id}:${draft.weekStart}:fixed` }]);
    } else if (s.kind === 'DEDUCTION') {
      lines.push(`• ${s.name}: berapa hari absen?`);
      keyboard.push(
        [0, 1, 2, 3].map((d) => ({
          text: d === 3 ? '3+' : String(d),
          callback_data: `ci:${s.id}:${draft.weekStart}:d${d}`,
        })),
      );
    } else {
      lines.push(`• ${s.name}: isi di web`);
    }
  }

  lines.push('', `Perkiraan: ${formatRp(draft.totalExpected)} · Tercatat: ${formatRp(draft.totalRecorded)}`);
  keyboard.push([{ text: '📝 Isi di web', url: checkinUrl }]);

  return { text: lines.join('\n'), keyboard };
}

/** Parse callback_data `ci:{streamId}:{weekStart}:{answer}` dari tombol inline keyboard. */
export function parseCheckinCallback(data: string): { streamId: number; weekStart: string; answer: string } | null {
  const match = /^ci:(\d+):(\d{4}-\d{2}-\d{2}):(\w+)$/.exec(data);
  if (!match) return null;
  return { streamId: Number(match[1]), weekStart: match[2], answer: match[3] };
}
