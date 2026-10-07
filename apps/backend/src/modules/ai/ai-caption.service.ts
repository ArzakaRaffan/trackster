import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AiService } from './ai.service';
import { forUser, getUserName } from '../../common/persona';

const CAPTION_SYSTEM_PROMPT = `Kamu nulis satu caption singkat (maks 12 kata) buat satu transaksi di feed finance tracker Arzaka. Nada santai, personal, kadang jenaka — bukan deskripsi ulang transaksinya, tapi observasi/komentar ringan. Bahasa Indonesia. Jangan pakai emoji lebih dari 1. Jawab HANYA captionnya, tanpa tanda kutip, tanpa embel-embel lain.`;

export interface CaptionableTransaction {
  id: number;
  description: string;
  amount: number;
  category: string;
  occurredAt: Date;
}

@Injectable()
export class AiCaptionService {
  private readonly logger = new Logger(AiCaptionService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  /** Fire-and-forget dari caller setelah transaksi tersimpan — kosmetik, gagal diam-diam
   *  (jangan pernah gagalkan pencatatan transaksi karena caption gagal generate). */
  async generate(userId: number, transaction: CaptionableTransaction): Promise<void> {
    try {
      const jam = transaction.occurredAt.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      });
      const formatRp = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

      const message = await this.aiService.chat({
        system: forUser(CAPTION_SYSTEM_PROMPT, await getUserName(this.prisma, userId)),
        messages: [
          {
            role: 'user',
            content: `${transaction.description} — ${formatRp(transaction.amount)} (${transaction.category}, ${jam} WIB)`,
          },
        ],
        maxTokens: 40,
        model: 'fast',
      });

      const caption = message?.content?.trim();
      if (!caption) return;

      await this.prisma.transaction.updateMany({
        where: { id: transaction.id, userId },
        data: { aiCaption: caption },
      });
    } catch (err: any) {
      this.logger.warn(`Caption gagal utk transaksi ${transaction.id}: ${err?.message}`);
    }
  }
}
