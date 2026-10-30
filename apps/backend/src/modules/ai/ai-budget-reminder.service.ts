import { Injectable } from '@nestjs/common';
import { TelegramService } from '../telegram/telegram.service';
import { BudgetService } from '../budget/budget.service';
import { BudgetOption, periodWords } from '../budget/budget-period';

const OPTION_LABEL: Record<BudgetOption, string> = { hemat: 'Hemat', seimbang: 'Seimbang', longgar: 'Longgar' };
const rp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

type CallbackQuery = { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };

/** Tombol Telegram lama. Cron "saran budget minggu depan" & check-in mingguan sudah dihapus (docs/budget-kebiasaan.md);
 * pesan lama yang masih punya tombol tetap dijawab dengan benar:
 * - `ba:{minggu}:{gaya}` → terapkan gaya lewat setelan (dulu menimpa nominal per hari = bobot hari user)
 * - `ci:...` (check-in) → arahkan ke catat pemasukan langsung */
@Injectable()
export class AiBudgetReminderService {
  constructor(
    private telegramService: TelegramService,
    private budgetService: BudgetService,
  ) {}

  async handleCallback(userId: number, cq: CallbackQuery) {
    const data = cq.data ?? '';
    const apply = /^ba:\d{4}-\d{2}-\d{2}:(hemat|seimbang|longgar)$/.exec(data);
    if (apply) {
      const option = apply[1] as BudgetOption;
      const s = await this.budgetService.applyStyle(userId, option);
      await this.telegramService.answerCallbackQuery(userId, cq.id, 'Diterapkan ✅');
      if (cq.message) {
        const text = `✅ <b>Gaya ${OPTION_LABEL[option]} diterapkan</b>\nJatah hari ini ${rp(s.budget)} · budget ${periodWords(s.cycle).label} ${rp(s.cycle.periodBudget)}`;
        await this.telegramService.editMessage(userId, String(cq.message.chat.id), cq.message.message_id, text);
      }
      return;
    }
    if (data.startsWith('ci:')) {
      await this.telegramService.answerCallbackQuery(userId, cq.id, 'Check-in sudah tidak dipakai — catat pemasukan langsung, mis. "+gaji 500rb"');
    }
  }
}
