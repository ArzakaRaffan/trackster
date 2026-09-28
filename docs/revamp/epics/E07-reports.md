# E07 — Laporan v2

**Fase 3 · 2 sesi · Permintaan #7** — "bagian paling penting menurut saya dari trackster"

> "saya rasa kurang maksimal menggambarkan laporan pengeluaran saya dalam satu minggu, satu bulan, 6 bulan, atau all time."

## Kondisi sekarang

`/app/reports` (589 baris): tab bulanan (`/transactions/monthly`), all-time (`/transactions/summary`), daftar
transaksi, detail per hari, langganan. Tidak ada mingguan/6 bulan, tidak ada pemasukan/net, tidak ada
pembanding, narasi AI mingguan/bulanan cuma dikirim ke Telegram lalu hilang.

## Prinsip

- **Satu struktur untuk semua periode**, isi menyesuaikan skala. Arzaka belajar membaca satu layout.
- **Periode kalender WIB**: Minggu = Senin–Minggu, Bulan, 6 Bulan (6 bulan kalender terakhir), Semua.
- **Laporan periode yang sudah tutup disimpan** (snapshot angka + narasi) → konsisten walau data berubah
  kemudian, bisa dibuka lagi, bisa dirujuk AI (retrieval E04-S3), bisa dibagikan.
- Angka dari `PeriodStatsService` (E06-S1). Narasi dari AI, berdasarkan angka itu.

## Data

```prisma
enum ReportPeriod { WEEK MONTH }

model PeriodReport {
  id          Int          @id @default(autoincrement())
  period      ReportPeriod
  periodStart DateTime     @db.Date
  stats       Json         // PeriodStats saat periode ditutup
  narrative   String?      // ringkasan Track (markdown pendek)
  generatedAt DateTime     @default(now())
  @@unique([period, periodStart])
}
```
6 Bulan & Semua tidak disimpan (dihitung live dari PeriodStats + PeriodReport bulanan).

## Layout laporan (semua periode)

```
[ Minggu | Bulan | 6 Bulan | Semua ]      ‹  22–28 Sep 2026  ›
┌ Hero ─────────────────────────────────┐
│ Net  +Rp120.000   Savings rate 9%     │
│ Masuk Rp1,35jt · Keluar Rp1,23jt      │
└───────────────────────────────────────┘
Ringkasan dari Track (narasi tersimpan, 3–5 kalimat + 1 saran)
vs periode sebelumnya: keluar rutin ↓12% · kopi ↑30% · pemasukan ↓Rp200rb
Grafik pengeluaran (skala periode, garis budget)
Kategori (dengan delta) → tap = merchant
Top merchant · 5 transaksi terbesar
Pemasukan per sumber vs perkiraan (E03)
Budget: hari over/under
Goal: progres selama periode
Langganan yang terbayar / jatuh tempo
[Bagikan gambar]  [Unduh CSV]
```

Skala per periode:

| Periode | Grafik | Tambahan khusus |
|---|---|---|
| Minggu | 7 batang harian + garis budget harian | Hari terbaik/terburuk, sisa budget minggu |
| Bulan | batang harian (28–31) + garis budget; toggle per minggu | Minggu terboros, proyeksi (bulan berjalan) |
| 6 Bulan | batang bulanan: masuk vs keluar + garis net | Bulan terbaik/terburuk, pergeseran kategori (bulan ini vs rata-rata 6 bln), rata-rata bulanan rutin |
| Semua | batang bulanan sejak data pertama | Total seumur hidup, rekor (transaksi terbesar, merchant paling sering, minggu paling hemat), milestone ("pertama kali savings rate > 20%") |

Data baru mulai 10 Agu 2026 → 6 Bulan/Semua harus menampilkan "Data mulai 10 Agu 2026" dengan jujur, bukan
bulan kosong bernilai 0.

---

## E07-S1 — Mingguan & Bulanan + snapshot tersimpan

> Scope layout dikurangi dari spesifikasi penuh di atas: "Pemasukan per sumber vs perkiraan" (butuh E03,
> belum ada di `PeriodStats`) dan "Goal: progres" di-skip dulu — bisa nempel gampang belakangan begitu E03/E05
> jalan, tapi belum ada datanya sekarang jadi nggak dipaksain. Hero, narasi, delta vs periode lalu, chart
> harian, kategori (dengan delta), top merchant, budget, dan langganan sudah ada.

- [x] Migration `add_period_report`; modul `report` terpisah (bukan di dalam `analytics`, biar tidak
      circular dependency dgn `AiModule` — pakai `forwardRef` dua arah seperti `TelegramModule`↔`AiModule`)
- [x] `ReportService.getReport(period, anchorDate)`: periode tutup → baca `PeriodReport` (generate kalau belum ada);
      periode berjalan → live dari PeriodStats (tanpa simpan, narasi opsional on-demand)
- [x] Cron tutup periode: Senin 06:00 WIB (minggu lalu), tanggal 1 06:30 WIB (bulan lalu). Generate narasi (AI_MODEL),
      simpan. Backfill eksplisit di-skip (ponytail: `getOrGenerate` sudah lazy-generate on-read pertama kali
      periode lama dibuka — cukup buat kebutuhan sekarang, tambah cron backfill terpisah kalau ternyata perlu
      generate semua sekaligus tanpa nunggu dibuka).
- [x] Ganti `AiReportsService.sendWeeklyInsight` & `sendMonthlyReportCard`: kirim narasi tersimpan + link ke
      `/app/reports?period=week&date=...`. Jadwal **Senin 07:00 WIB** (dikonfirmasi Arzaka, gantiin Minggu 20:00
      lama) — `weekly-goal-nudge` ikut digeser ke Senin 07:10 biar urutannya tetap benar.
- [x] Prompt narasi: pakai angka dari stats saja, sebut 1 hal baik + 1 hal yang perlu diperbaiki + 1 saran
      konkret minggu/bulan depan. Belum pakai memory AI (E04) — opsional di spec, di-skip sesi ini.
- [x] Frontend: switcher periode + navigasi ‹ › + layout di atas untuk Minggu & Bulan; transaksi list & detail
      hari yang sudah ada tetap bisa diakses (tab "Semua transaksi", eks-`AllTimeTab`)
- [x] Verifikasi: `tsc --noEmit` (backend+frontend) & `nest build`/`next build` lolos bersih. API diverifikasi
      langsung lewat curl lokal (dev DB): minggu berjalan live, minggu 20–27 Sep & bulan Agustus closed →
      snapshot `PeriodReport` ke-generate & ke-cache (generatedAt stabil di request kedua). **Belum** cek visual
      di browser — Claude in Chrome extension nggak connect di sesi ini; halaman lolos render tanpa error
      (curl shell HTML + dev server log bersih) tapi bagian yang butuh JS (hero, chart, narasi) belum
      dikonfirmasi visual. Cek manual di browser sebelum push.

## E07-S2 — 6 Bulan, Semua, export & bagikan

- [x] 6 Bulan & Semua sesuai tabel skala (agregat dari PeriodReport bulanan + bulan berjalan live)
- [x] Rekor & milestone (All-time) — dihitung, bukan AI
- [x] Bagikan gambar: `html-to-image`; kartu ringkas (hero + kategori top 3), tanpa saldo & nama merchant sensitif
- [x] Unduh CSV transaksi periode (`GET /reports/export.csv?from=&to=`, JwtAuthGuard)
- [x] `tsc --noEmit` backend + frontend lolos bersih. Belum cek visual mobile 390px — cek manual di browser.
