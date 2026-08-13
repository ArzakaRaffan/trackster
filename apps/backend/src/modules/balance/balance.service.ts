import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma, Source } from '@prisma/client';

@Injectable()
export class BalanceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Gerakin saldo sebuah bank secara inkremental (delta bisa negatif). WAJIB dipanggil dengan
   * tx client dari db transaction yang sama dengan operasi pemicunya (create/delete transaksi
   * atau income) — supaya saldo dan record utamanya selalu konsisten, tidak pernah salah satu
   * doang yang tersimpan. Saldo TIDAK PERNAH dihitung ulang dari agregat; murni akumulasi delta
   * dari baseline manual, dikoreksi manual via correctBalance() kalau meleset.
   */
  async adjustBalance(tx: Prisma.TransactionClient, source: Source, delta: number) {
    await tx.bankBalance.upsert({
      where: { source },
      update: { balance: { increment: delta } },
      create: { source, balance: delta },
    });
  }

  async getAll() {
    return this.prisma.bankBalance.findMany({ orderBy: { source: 'asc' } });
  }

  /** Koreksi manual ke angka pasti (bukan delta) — dicatat sebagai BalanceAdjustment buat histori. */
  async correctBalance(source: Source, newBalance: number, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.bankBalance.findUnique({ where: { source } });
      const oldBalance = existing ? Number(existing.balance) : 0;
      const delta = newBalance - oldBalance;

      const updated = await tx.bankBalance.upsert({
        where: { source },
        update: { balance: newBalance },
        create: { source, balance: newBalance },
      });

      await tx.balanceAdjustment.create({ data: { source, delta, note } });

      return updated;
    });
  }

  async getAdjustments(source: Source) {
    return this.prisma.balanceAdjustment.findMany({
      where: { source },
      orderBy: { createdAt: 'desc' },
    });
  }
}
