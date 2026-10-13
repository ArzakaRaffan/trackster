import { BadRequestException, Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { newLocalPart } from '../inbound/inbound.util';
import { OwnAccountDto } from './dto/profile.dto';

/** Profil & onboarding per user: nama, rekening sendiri, bank yang dipakai, alamat forwarding, checklist aktivasi. */
@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async get(userId: number) {
    const [user, accounts, balances, inbound, lastFwd, adjustments, streams, tokenUsed, telegram, txCount] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true, displayName: true, fullName: true, role: true, onboardedAt: true } }),
      this.prisma.ownAccount.findMany({ where: { userId }, orderBy: { id: 'asc' }, select: { id: true, source: true, label: true, accountNumber: true } }),
      this.prisma.bankBalance.findMany({ where: { userId }, orderBy: { source: 'asc' }, select: { source: true } }),
      this.inbound(userId),
      this.prisma.emailParseLog.findFirst({
        where: { userId, emailId: { startsWith: 'fwd:' } },
        orderBy: { createdAt: 'desc' },
        select: { status: true, createdAt: true, counterparty: true, amount: true, parser: true },
      }),
      this.prisma.balanceAdjustment.count({ where: { userId } }),
      this.prisma.incomeStream.count({ where: { userId, isActive: true } }),
      this.prisma.apiToken.count({ where: { userId, lastUsedAt: { not: null } } }),
      this.prisma.telegramLink.count({ where: { userId, isActive: true } }),
      this.prisma.transaction.count({ where: { userId } }),
    ]);
    const domain = process.env.INBOUND_DOMAIN || 'in.trackster.dev';
    return {
      username: user.username,
      displayName: user.displayName ?? user.username,
      fullName: user.fullName ?? '',
      role: user.role,
      onboardedAt: user.onboardedAt,
      accounts,
      banks: balances.map((b) => b.source),
      inbound: {
        address: `u+${inbound.localPart}@${domain}`,
        verified: !!inbound.forwardVerifiedAt,
        active: inbound.isActive,
        lastEmailAt: inbound.lastEmailAt,
        forwardCode: inbound.lastForwardCode,
        forwardCodeAt: inbound.lastForwardCodeAt,
        gmailSource: inbound.gmailSource,
        shadow: inbound.shadow,
        lastResult: lastFwd
          ? { status: lastFwd.status, at: lastFwd.createdAt, counterparty: lastFwd.counterparty, amount: lastFwd.amount == null ? null : Number(lastFwd.amount), parser: lastFwd.parser }
          : null,
      },
      checklist: {
        profile: !!user.fullName && accounts.length > 0,
        balance: adjustments > 0,
        income: streams > 0,
        forwarding: !!inbound.forwardVerifiedAt,
        shortcut: tokenUsed > 0,
        telegram: telegram > 0,
        firstTransaction: txCount > 0,
      },
    };
  }

  /** Alamat forwarding dibuat malas saat pertama dibutuhkan. User yang masih memakai Gmail sync (pemilik) mulai dalam
   *  mode shadow: email yang diteruskan hanya dicatat di log, supaya tidak dobel dengan hasil Gmail (P3). */
  private async inbound(userId: number) {
    const existing = await this.prisma.inboundAddress.findUnique({ where: { userId } });
    if (existing) return existing;
    const usesGmail = (await this.prisma.gmailToken.count({ where: { userId } })) > 0;
    try {
      return await this.prisma.inboundAddress.create({ data: { userId, localPart: newLocalPart(), shadow: usesGmail } });
    } catch (e: any) {
      // dua request pertama bersamaan: yang kalah membaca baris milik yang menang
      if (e?.code === 'P2002') return this.prisma.inboundAddress.findUniqueOrThrow({ where: { userId } });
      throw e;
    }
  }

  async update(userId: number, dto: { displayName?: string; fullName?: string; forwarding?: boolean }) {
    if (dto.forwarding !== undefined) {
      await this.inbound(userId); // pastikan baris ada
      await this.prisma.inboundAddress.updateMany({ where: { userId }, data: { isActive: dto.forwarding } });
    }
    const data: { displayName?: string; fullName?: string | null } = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName.trim();
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim().replace(/\s+/g, ' ') || null;
    if (Object.keys(data).length) await this.prisma.user.update({ where: { id: userId }, data });
    return this.get(userId);
  }

  /** Ganti seluruh daftar rekening milik user (form kecil, ≤10 baris — lebih sederhana dari CRUD per baris). */
  async replaceAccounts(userId: number, accounts: OwnAccountDto[]) {
    const rows = accounts.map((a) => ({ ...a, accountNumber: a.accountNumber.replace(/\D/g, '') }));
    if (rows.some((a) => a.accountNumber.length < 6 || a.accountNumber.length > 20)) throw new BadRequestException('Nomor rekening harus 6–20 digit');
    const unique = [...new Map(rows.map((a) => [a.accountNumber, a])).values()];
    await this.prisma.$transaction([
      this.prisma.ownAccount.deleteMany({ where: { userId } }),
      this.prisma.ownAccount.createMany({
        data: unique.map((a) => ({ userId, accountNumber: a.accountNumber, source: a.source ?? null, label: a.label?.trim() || null })),
      }),
    ]);
    return this.get(userId);
  }

  /** Bank yang dipakai = baris BankBalance. Hanya MENAMBAH (baris lama bisa punya saldo & histori — tidak dihapus). */
  async addBanks(userId: number, sources: Source[]) {
    for (const source of new Set(sources)) {
      if (await this.prisma.bankBalance.findFirst({ where: { userId, source }, select: { id: true } })) continue;
      await this.prisma.bankBalance.create({ data: { userId, source, balance: 0 } });
    }
    return this.get(userId);
  }

  async finishOnboarding(userId: number) {
    await this.prisma.user.updateMany({ where: { id: userId, onboardedAt: null }, data: { onboardedAt: new Date() } });
    return this.get(userId);
  }
}
