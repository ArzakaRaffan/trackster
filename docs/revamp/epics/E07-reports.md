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

- [ ] Migration `add_period_report`; modul `report` (atau di dalam `analytics`, pilih yang lebih sedikit file)
- [ ] `ReportService.getReport(period, anchorDate)`: periode tutup → baca `PeriodReport` (generate kalau belum ada);
      periode berjalan → live dari PeriodStats (tanpa simpan, narasi opsional on-demand)
- [ ] Cron tutup periode: Senin 06:00 WIB (minggu lalu), tanggal 1 06:30 WIB (bulan lalu). Generate narasi (AI_MODEL),
      simpan. Backfill sekali untuk minggu/bulan sejak 10 Agu 2026.
- [ ] Ganti `AiReportsService.sendWeeklyInsight` & `sendMonthlyReportCard`: kirim narasi tersimpan + link ke
      `/app/reports?period=week&date=...`. Jadwal default Senin 07:00 WIB (minggu lengkap) — **tanya Arzaka**
      apakah tetap mau Minggu 20:00 (pratinjau).
- [ ] Prompt narasi: pakai angka dari stats saja, sebut 1 hal baik + 1 hal yang perlu diperbaiki + 1 saran
      konkret minggu/bulan depan; boleh pakai memory AI (E04) kalau ada ("progres laptop: …").
- [ ] Frontend: switcher periode + navigasi ‹ › + layout di atas untuk Minggu & Bulan; transaksi list & detail
      hari yang sudah ada tetap bisa diakses (tab/section "Semua transaksi")
- [ ] Verifikasi: minggu 15–21 Sep & bulan Agustus terbuka dengan narasi tersimpan; minggu berjalan live

## E07-S2 — 6 Bulan, Semua, export & bagikan

- [ ] 6 Bulan & Semua sesuai tabel skala (agregat dari PeriodReport bulanan + bulan berjalan live)
- [ ] Rekor & milestone (All-time) — dihitung, bukan AI
- [ ] Bagikan gambar: reuse pola `html-to-image` dari kalkulator tabungan; kartu ringkas (hero + kategori top 3),
      **tanpa** saldo & nama merchant sensitif by default (toggle)
- [ ] Unduh CSV transaksi periode (`GET /reports/export.csv?from=&to=`, JwtAuthGuard)
- [ ] Verifikasi mobile 390px untuk keempat periode
