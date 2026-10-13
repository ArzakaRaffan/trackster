import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { simpleParser } from 'mailparser';
import { PrismaService } from '../../prisma.service';
import { EmailPipelineService } from '../gmail/email-pipeline.service';
import { ParserRegistryService } from '../gmail/parsers/parser-registry.service';
import { RawEmail } from '../gmail/parsers/parser.interface';
import { TelegramService } from '../telegram/telegram.service';
import { forwardEmailId, mailBodyText, parseForwardConfirmation, parseLocalPart, sha256hex, verifySignature } from './inbound.util';

@Injectable()
export class InboundService {
  private readonly logger = new Logger(InboundService.name);

  constructor(
    private prisma: PrismaService,
    private pipeline: EmailPipelineService,
    private parsers: ParserRegistryService,
    private telegram: TelegramService,
  ) {}

  /** Email bertanda tangan sah selalu dibalas ok (200) walau dibuang, supaya Worker tak retry & tak bocor info. */
  async handle(body: Buffer, h: { to?: string; timestamp?: string; signature?: string }): Promise<{ ok: true; result: string }> {
    const secret = process.env.INGEST_HMAC_SECRET;
    if (!secret) throw new ServiceUnavailableException('Inbound email belum dikonfigurasi');
    if (!verifySignature(secret, h.timestamp, h.signature, h.to, body)) throw new UnauthorizedException('Tanda tangan tidak valid');

    const domain = process.env.INBOUND_DOMAIN || 'in.trackster.dev';
    const localPart = parseLocalPart(h.to, domain);
    // tenancy-ok: ini satu-satunya tempat userId DITURUNKAN dari alamat rahasia (localPart unik)
    const addr = localPart ? await this.prisma.inboundAddress.findUnique({ where: { localPart } }) : null;
    if (!addr || !addr.isActive) {
      this.logger.warn('inbound: alamat tak dikenal/nonaktif -> dibuang');
      return { ok: true, result: 'ignored' };
    }
    const userId = addr.userId;
    await this.prisma.inboundAddress.update({ where: { id: addr.id, userId }, data: { lastEmailAt: new Date() } });

    const mail = await simpleParser(body);
    const from = mail.from?.text ?? '';
    const subject = mail.subject ?? '';
    const receivedAt = mail.date ?? new Date();

    const confirm = parseForwardConfirmation(from, subject, mail.text ?? '');
    if (confirm) {
      await this.prisma.inboundAddress.update({
        where: { id: addr.id, userId },
        data: { lastForwardCode: confirm.code, lastForwardCodeAt: new Date(), ...(confirm.gmailSource ? { gmailSource: confirm.gmailSource } : {}) },
      });
      return { ok: true, result: 'forward-confirmation' };
    }

    const text = mailBodyText(body, mail);
    const emailId = forwardEmailId(mail.messageId, `${from}|${subject}|${receivedAt.toISOString()}|${sha256hex(body)}`);
    const raw: RawEmail = { id: emailId, from, subject, body: text, internalDate: String(receivedAt.getTime()) };

    // Minimasi data: pengirim bukan bank (sumber kebenaran = canHandle parser) -> buang, tidak disimpan.
    if (!this.parsers.canHandle(raw)) {
      this.logger.debug('inbound: bukan email bank -> dibuang');
      return { ok: true, result: 'dropped' };
    }

    if (!addr.forwardVerifiedAt) {
      await this.prisma.inboundAddress.update({ where: { id: addr.id, userId }, data: { forwardVerifiedAt: new Date() } });
    }

    let result = 'processed';
    const rec: { newest?: { source: string; description: string; amount: number } } = {};
    const notify = !addr.shadow && (await this.telegram.isNotifyEveryTransactionEnabled(userId));
    await this.pipeline.process(
      userId, emailId, text ? raw : null, { from, subject, receivedAt }, notify,
      {
        onRecorded: (t) => { rec.newest = t; result = 'recorded'; },
        onIncomeRecorded: () => { result = 'income'; },
        onDuplicate: () => { result = 'duplicate'; },
        onExcluded: () => { result = 'excluded'; },
        onUnparsed: () => { result = 'unparsed'; },
      },
      { shadow: addr.shadow },
    );
    if (addr.shadow) result = 'shadow';
    if (rec.newest) await this.pipeline.checkAndAlertIfOverBudget(userId, rec.newest);
    return { ok: true, result };
  }
}
