import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class MerchantAliasService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.merchantAlias.findMany({ orderBy: { displayName: 'asc' } });
  }

  /** rawDescription unique — kalau sudah ada alias buat description itu, update displayName-nya
   * (bukan bikin duplikat / lempar unique constraint error). */
  async upsert(rawDescription: string, displayName: string) {
    return this.prisma.merchantAlias.upsert({
      where: { rawDescription },
      update: { displayName },
      create: { rawDescription, displayName },
    });
  }

  async update(id: number, displayName: string) {
    return this.prisma.merchantAlias.update({ where: { id }, data: { displayName } });
  }

  /** Hapus alias — transaksi terkait otomatis balik nampilin raw description asli lewat
   * attachDisplayNames() (fallback ke description kalau tidak ada baris alias yang match). */
  async remove(id: number) {
    return this.prisma.merchantAlias.delete({ where: { id } });
  }

  /** Tempel field displayDescription (alias kalau ada, fallback ke description asli) ke tiap
   * transaksi. Satu query buat seluruh batch — TIDAK query per-transaksi. `description` asli
   * tidak pernah diubah/ditimpa, tetap dipakai buat search matching & referensi internal parser. */
  async attachDisplayNames<T extends { description: string }>(
    transactions: T[],
  ): Promise<(T & { displayDescription: string })[]> {
    if (transactions.length === 0) return [];

    const uniqueDescriptions = [...new Set(transactions.map((t) => t.description))];
    const aliases = await this.prisma.merchantAlias.findMany({
      where: { rawDescription: { in: uniqueDescriptions } },
    });
    const aliasMap = new Map(aliases.map((a) => [a.rawDescription, a.displayName]));

    return transactions.map((t) => ({ ...t, displayDescription: aliasMap.get(t.description) ?? t.description }));
  }

  /** Cari rawDescription dari semua alias yang displayName-nya cocok search term — dipakai supaya
   * search transaksi juga nemu lewat nama alias, bukan cuma raw description mentah. */
  async findRawDescriptionsMatchingSearch(search: string): Promise<string[]> {
    const matches = await this.prisma.merchantAlias.findMany({
      where: { displayName: { contains: search, mode: 'insensitive' } },
      select: { rawDescription: true },
    });
    return matches.map((m) => m.rawDescription);
  }
}
