# E06 — Analisis v2

**Fase 3 · 2 sesi · Permintaan #6**

> "Analisis juga sangat minimum, saya hampir tidak mendapatkan informasi atau insight apa apa dari analisis
> keuangan saya. (Analisis All time dan 30d sama aja gaada bedanya)"

## Kenapa sekarang terasa kosong ([findings C, D](../01-findings.md#d-analisis--laporan))

1. Data baru mulai 10 Agu 2026 → "Semua" ≈ "30 hari".
2. Kartu tren & kepatuhan budget di `getInsights()` tidak ikut `range`.
3. Tidak ada pembanding — angka tanpa "naik/turun dari biasanya" tidak bermakna.
4. Pembelian besar (Monitor 1,69jt, MOBI 2,62jt) mencampur rata-rata → semua angka harian menyesatkan.
5. 39% `LAINNYA` → breakdown kategori tidak informatif (diperbaiki E00-S3).
6. Budget weekend 0 → "kepatuhan budget" selalu jelek.

**Pembagian peran yang jelas** (supaya tidak tumpang tindih dengan Laporan):
- **Analisis = "kenapa & pola"** — rentang bergulir (7/30/90 hari/semua), kebiasaan, anomali, pola waktu.
- **Laporan (E07) = "apa yang terjadi di periode X"** — periode kalender (minggu/bulan/6 bulan/semua), tersimpan, bisa dibagikan.

Keduanya membaca **satu** service: `PeriodStatsService`.

---

## E06-S1 — `PeriodStatsService` (fondasi Analisis, Laporan, Budget, AI)

Modul baru `apps/backend/src/modules/analytics/`. Satu fungsi utama:

```ts
getPeriodStats({ start, end, compare = true }): PeriodStats   // start/end instant UTC dari wib.ts, end eksklusif

interface PeriodStats {
  range: { start: string; end: string; days: number; dataStartsAt: string }  // dataStartsAt = transaksi pertama
  totals: {
    spend: number; spendRoutine: number; spendBig: number; txCount: number
    avgRoutinePerDay: number
    income: number            // Income CONFIRMED saja
    net: number; savingsRate: number | null   // null kalau income 0
  }
  previous?: PeriodStats['totals'] & { start: string; end: string }   // periode sebelumnya dengan panjang sama
  byCategory: { category; total; count; prevTotal? }[]
  byMerchant: { merchantKey; displayName; total; count; avgTicket; prevTotal?; perWeek }[]   // pakai Transaction.merchantKey (E00-S3)
  byDay: { date; spend; spendRoutine; budget; income }[]          // kunci tanggal WIB
  byWeekday: { dayOfWeek; avgRoutine }[]
  timeHeatmap: { dayOfWeek; bucket: 'pagi'|'siang'|'sore'|'malam'|'larut'; count; total }[]
  bigPurchases: Transaction[]
  anomalies: { tx: Transaction; reason: string }[]
  habits: { merchantKey; displayName; count; total; perWeek; annualized }[]   // ≥3 kunjungan & ≥1x/minggu
  budget: { daysWithBudget; daysOver; adherencePct; streakUnder; worstWeekday }
  dataQuality: { lainnyaPct; pendingIncomeCount; unparsedEmailCount }
}
```

**Definisi (tulis juga di Decisions.md):**
- **Pembelian besar** = `amount ≥ max(Rp300.000, 5 × median nominal transaksi 90 hari)`, bisa di-override per
  transaksi lewat kolom baru `Transaction.isBig Boolean?` (null = pakai aturan). Tombol "Tandai rutin / besar" di detail transaksi.
  Kategori `TOPUP` & `TRANSFER` tetap dihitung pengeluaran tapi ditampilkan terpisah di breakdown.
- **Rutin** = semua yang bukan besar.
- **Anomali** = transaksi rutin > 3× median nominal kategorinya (90 hari) atau merchant baru dengan nominal > p90.
- **Kepatuhan budget** dihitung hanya untuk hari dengan budget > 0; hari budget 0 ditandai "tanpa budget" (+ saran di E05).
- Bucket waktu (WIB): pagi 05–11, siang 11–15, sore 15–18, malam 18–22, larut 22–05.

**Tasks**
- [ ] Migration `Transaction.isBig`
- [ ] `PeriodStatsService` + `period-stats.check.ts` (data sintetis: pembelian besar terpisah, pembanding periode, kunci WIB)
- [ ] Endpoint `GET /analytics/stats?from=&to=` dan `GET /analytics/stats?range=7d|30d|90d|all`
- [ ] Tool AI `getPeriodStats` diarahkan ke sini (kalau E04-S4 sudah ada)
- [ ] `getInsights()` lama: jadikan wrapper tipis di atas PeriodStats (dipakai weekly report/health score/mascot) atau
      ganti pemanggilnya — jangan biarkan dua implementasi hidup

## E06-S2 — Halaman Analisis v2 (`/app/insights`)

Urutan section (mobile-first, satu kolom; ≥1024px dua kolom):

1. **Range** `7H · 30H · 90H · Semua` + label "vs 30 hari sebelumnya". Kalau periode pembanding sebelum
   `dataStartsAt` → tulis "belum ada data pembanding" (jangan tampilkan +100%).
2. **"3 hal yang perlu kamu tahu"** — kartu AI: input = PeriodStats (JSON ringkas), output 3 poin tajam
   (satu kalimat + angka). Cache per `range` per hari WIB (tabel kecil `AiInsightCache {key unique, content, createdAt}`
   atau kolom di tabel yang ada — pilih yang paling sedikit kode). Angka di kartu harus berasal dari stats.
3. **KPI** (4 tile, masing-masing dengan delta ↑↓ vs pembanding): Keluar rutin · Pembelian besar · Rata-rata
   rutin/hari · Net (kalau income ada).
4. **Kebiasaan** — top 5 habit: "Kopi Kenangan · 12× · Rp266rb · ≈ Rp3,2jt/tahun", tap → daftar transaksinya.
5. **Kategori** — batang horizontal periode ini vs pembanding (dua warna), tap kategori → merchant di dalamnya.
6. **Pola waktu** — heatmap 7 hari × 5 bucket (grid div, bukan library), intensitas = total. Kalimat bawah:
   "Paling boros: Jumat malam".
7. **Tren** (90H/Semua) — batang mingguan bertumpuk per kategori (recharts).
8. **Pembelian besar** & **Tidak biasa** — dua list pendek, tombol "tandai rutin".
9. **Budget** — hari over/under (hanya hari berbudget), hari terburuk, streak.
10. **Kualitas data** (footer kecil, cuma muncul kalau ada masalah): "12% masih LAINNYA → Rapikan kategori",
    "3 pemasukan belum dikonfirmasi", "2 email gagal dibaca".
11. Health score history (yang sudah ada) — pindah ke bawah; formula health score diarahkan ke PeriodStats
    (budget adherence baru + savings rate dari income CONFIRMED).

Baca skill `dataviz` sebelum bikin chart. Pakai recharts yang sudah terpasang.

**Tasks**
- [ ] Endpoint kartu AI + cache
- [ ] Rebuild halaman sesuai urutan di atas (reuse `StatTile`, `DayBarChart`, `AnimatedTabContent`)
- [ ] Health score pakai PeriodStats
- [ ] Verifikasi di browser dengan data salinan prod: 7H vs 30H vs Semua **terlihat berbeda** dan tiap angka punya pembanding

**Acceptance:** Arzaka bisa menjawab dari halaman ini tanpa tanya AI: "aku boros di mana?", "kapan aku
biasanya boros?", "kebiasaan apa yang paling mahal setahun?", "minggu ini lebih baik atau lebih buruk dari biasanya?".
