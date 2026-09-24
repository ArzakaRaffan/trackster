import { Injectable } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { merchantKey } from '../../common/merchant-key';

@Injectable()
export class MerchantAliasService {
  constructor(private prisma: PrismaService) {}

  /** Cuma alias yang punya displayName (rule kategori murni tanpa nama tampilan disembunyikan
   * dari halaman ini — nggak relevan buat "ganti nama merchant"). */
  async findAll() {
    return this.prisma.merchantAlias.findMany({
      where: { displayName: { not: null } },
      orderBy: { displayName: 'asc' },
    });
  }

  /** Rule kategori by merchantKey (bukan rawDescription exact) — biar "Kopi Kenangan 1320" dan
   * "Kopi Kenangan QR BRI 1 1" kena rule yang sama. Tabelnya kecil, jadi cek in-memory per
   * description cukup murah, gak perlu kolom merchantKey terpisah di MerchantAlias. */
  async findCategoryForDescription(description: string): Promise<Category | null> {
    const key = merchantKey(description);
    if (!key) return null;

    const rules = await this.prisma.merchantAlias.findMany({
      where: { category: { not: null } },
      select: { rawDescription: true, category: true },
    });
    const match = rules.find((r) => merchantKey(r.rawDescription) === key);
    return match?.category ?? null;
  }

  /** Simpan/perbarui rule kategori untuk merchant ini (dipakai AI-learn & koreksi manual user).
   * Tidak menyentuh displayName yang mungkin sudah ada. */
  async upsertCategory(rawDescription: string, category: Category) {
    return this.prisma.merchantAlias.upsert({
      where: { rawDescription },
      update: { category },
      create: { rawDescription, category },
    });
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
