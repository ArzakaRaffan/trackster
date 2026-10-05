import { Injectable, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { merchantKey } from '../../common/merchant-key';

@Injectable()
export class MerchantAliasService {
  constructor(private prisma: PrismaService) {}

  /** Cuma alias yang punya displayName (rule kategori murni tanpa nama tampilan disembunyikan
   * dari halaman ini — nggak relevan buat "ganti nama merchant"). */
  async findAll(userId: number) {
    return this.prisma.merchantAlias.findMany({
      where: { userId, displayName: { not: null } },
      orderBy: { displayName: 'asc' },
    });
  }

  /** Rule kategori by merchantKey (bukan rawDescription exact) — biar "Kopi Kenangan 1320" dan
   * "Kopi Kenangan QR BRI 1 1" kena rule yang sama. Tabelnya kecil, jadi cek in-memory per
   * description cukup murah, gak perlu kolom merchantKey terpisah di MerchantAlias. */
  async findCategoryForDescription(userId: number, description: string): Promise<Category | null> {
    const key = merchantKey(description);
    if (!key) return null;

    const rules = await this.prisma.merchantAlias.findMany({
      where: { userId, category: { not: null } },
      select: { rawDescription: true, category: true },
    });
    const match = rules.find((r) => merchantKey(r.rawDescription) === key);
    return match?.category ?? null;
  }

  /** Simpan/perbarui rule kategori untuk merchant ini (dipakai AI-learn & koreksi manual user).
   * Tidak menyentuh displayName yang mungkin sudah ada. */
  async upsertCategory(userId: number, rawDescription: string, category: Category) {
    return this.upsertAlias(userId, rawDescription, { category });
  }

  /** rawDescription unique — kalau sudah ada alias buat description itu, update displayName-nya
   * (bukan bikin duplikat / lempar unique constraint error). */
  async upsert(userId: number, rawDescription: string, displayName: string) {
    return this.upsertAlias(userId, rawDescription, { displayName });
  }

  /** findFirst + update/create (bukan upsert by `rawDescription`): unik masih global sampai C1, lalu jadi (userId, rawDescription). */
  private async upsertAlias(
    userId: number,
    rawDescription: string,
    data: { displayName?: string; category?: Category; icon?: string | null },
  ) {
    const existing = await this.prisma.merchantAlias.findFirst({ where: { userId, rawDescription }, select: { id: true } });
    if (existing) {
      await this.prisma.merchantAlias.updateMany({ where: { id: existing.id, userId }, data });
      return this.prisma.merchantAlias.findFirstOrThrow({ where: { id: existing.id, userId } });
    }
    return this.prisma.merchantAlias.create({ data: { userId, rawDescription, ...data } });
  }

  async update(userId: number, id: number, data: { displayName?: string; icon?: string | null }) {
    const { count } = await this.prisma.merchantAlias.updateMany({ where: { id, userId }, data });
    if (count === 0) throw new NotFoundException(`Alias ${id} tidak ditemukan`);
    return this.prisma.merchantAlias.findFirstOrThrow({ where: { id, userId } });
  }

  /** Set/hapus logo merchant tanpa menyentuh displayName/kategori (baris dibuat kalau belum ada). */
  async setIcon(userId: number, rawDescription: string, icon: string | null) {
    return this.upsertAlias(userId, rawDescription, { icon });
  }

  async findCategoryIcons(userId: number) {
    return this.prisma.categoryIcon.findMany({ where: { userId } });
  }

  async setCategoryIcon(userId: number, category: Category, icon: string | null) {
    if (!icon) return this.prisma.categoryIcon.deleteMany({ where: { userId, category } });
    // PK `category` masih global sampai C1 (jadi (userId, category)); findFirst+updateMany/create tetap benar sesudahnya.
    const existing = await this.prisma.categoryIcon.findFirst({ where: { userId, category } });
    if (existing) return this.prisma.categoryIcon.updateMany({ where: { userId, category }, data: { icon } });
    return this.prisma.categoryIcon.create({ data: { userId, category, icon } });
  }

  /** Hapus alias — transaksi terkait otomatis balik nampilin raw description asli lewat
   * attachDisplayNames() (fallback ke description kalau tidak ada baris alias yang match). */
  async remove(userId: number, id: number) {
    const { count } = await this.prisma.merchantAlias.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException(`Alias ${id} tidak ditemukan`);
    return { id };
  }

  /** Tempel field displayDescription (alias kalau ada, fallback ke description asli) ke tiap
   * transaksi. Satu query buat seluruh batch — TIDAK query per-transaksi. `description` asli
   * tidak pernah diubah/ditimpa, tetap dipakai buat search matching & referensi internal parser. */
  async attachDisplayNames<T extends { description: string }>(
    userId: number,
    transactions: T[],
  ): Promise<(T & { displayDescription: string; icon: string | null })[]> {
    if (transactions.length === 0) return [];

    const uniqueDescriptions = [...new Set(transactions.map((t) => t.description))];
    const aliases = await this.prisma.merchantAlias.findMany({
      where: { userId, rawDescription: { in: uniqueDescriptions } },
    });
    const aliasMap = new Map(aliases.map((a) => [a.rawDescription, a]));

    return transactions.map((t) => {
      const a = aliasMap.get(t.description);
      return { ...t, displayDescription: a?.displayName ?? t.description, icon: a?.icon ?? null };
    });
  }

  /** Cari rawDescription dari semua alias yang displayName-nya cocok search term — dipakai supaya
   * search transaksi juga nemu lewat nama alias, bukan cuma raw description mentah. */
  async findRawDescriptionsMatchingSearch(userId: number, search: string): Promise<string[]> {
    const matches = await this.prisma.merchantAlias.findMany({
      where: { userId, displayName: { contains: search, mode: 'insensitive' } },
      select: { rawDescription: true },
    });
    return matches.map((m) => m.rawDescription);
  }
}
