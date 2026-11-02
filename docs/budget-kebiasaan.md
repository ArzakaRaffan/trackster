# Budget dari Kebiasaan + Analisis Kebiasaan Mingguan

> Status: **diimplementasi 2026-11-01** di branch `feat/budget-kebiasaan` (belum di `main`). Menggantikan
> [`siklus-gajian.md`](siklus-gajian.md).

## Kenapa

Model lama terasa personal dan membingungkan: 3 mode budget (Tetap/Siklus/Saldo), 5 jenis pemasukan (sesi les, potongan absen
magang, …), check-in mingguan, forecast, saran 50/30/20 yang menimpa nominal harian, dan gaya hemat/seimbang/longgar yang
butuh tombol "Terapkan" terpisah. Rumus saldo ÷ 30 hari menganggap user mau menghabiskan seluruh saldo.

## Keputusan Arzaka (2026-10-30)

1. Uang yang masuk di tengah periode langsung dipakai periode itu.
2. User tanpa pemasukan pasti menentukan sendiri mau belanja berapa per minggu/bulan.
3. User lama dipindah otomatis + banner "Cek cara budget barumu".
4. Setelah ≥3 pembayaran, dasar budget = **kebiasaan asli** (median yang benar-benar masuk), bukan angka saat daftar.
5. Dibuang: check-in mingguan, jenis pemasukan di UI + forecast, pilihan 3 mode, saran 50/30/20 + alokasi mingguan.

## Model

- **Periode**: mingguan (mulai hari X) / bulanan (mulai tanggal X). Pemasukan pasti utama (`anchorStreamId`) dengan jadwal
  sama → gaji yang masuk ≤2 hari (mingguan) / ≤7 hari (bulanan) lebih awal membuka periode baru (`cycleBounds`).
- **INCOME**: Σ pasti (`diterima + biasanya × payday yang belum masuk`) + tambahan − `reservePct`%.
- **TARGET**: `targetAmount` (atau belanja rutin biasanya kalau kosong) + tambahan yang sudah masuk (keputusan Arzaka
  2026-11-02: uang tambahan tetap menambah budget periode itu; pemasukan pasti tidak, target sudah mewakilinya). Carry TARGET
  = target + tambahan periode lalu − belanjanya.
- `sisa = budget + carry − langganan [hari ini, akhir) − belanja [awal, hari ini)`; `jatah = sisa × w[hari ini] / Σ w[hari ini..akhir)`.
- **Periode pertama**: perkiraan & target diprorata dengan bobot hari sejak hari pertama memakai Trackster; payday sebelum
  itu tidak dianggap "belum masuk".
- **Pola harian** (`dayWeights`): "belajar dari kebiasaan" = rata-rata belanja rutin per hari 8 minggu (≥4 minggu, lantai
  40%; riwayat belum cukup → **rata**, bukan `DailyBudget`); "atur sendiri" = `DailyBudget` sebagai bobot. Langsung berlaku:
  `PUT /budget/weights {autoWeights, amounts?}` → ringkasan baru (lewat `updateSettings`, jadi setelan lama ikut tersimpan
  dan banner hilang). Layar: pindah ke atur sendiri = mulai dari pola yang tampil (atau pola lama yang tidak rata), ketikan
  dipratinjau lokal lalu disimpan otomatis berurutan (600 ms). Hari terakhir periode → bobot tidak berpengaruh (catatan di UI).
- **Gaya**: INCOME → sisihkan 15/10/5%; TARGET → 85/100/110% belanja biasanya. Diklik = langsung berlaku.

## Kebiasaan mingguan (`habit-engine.ts`)

Membandingkan minggu (Senin–Minggu) dengan minggu-minggu penuh sebelumnya sejak user mulai (≥3 minggu, kalau belum →
"masih kenalan, minggu n dari 3"). Insight (maks 5, warn → good → info): pemasukan pasti telat, belanja vs pace biasanya,
merchant lebih sering/jarang, kebiasaan baru, kategori naik, streak di bawah jatah, pemasukan vs biasanya, hari & jam paling boros.

## Tempat dipakai

Beranda (kartu), Laporan mingguan (kartu + snapshot `PeriodReport.stats.habits` + input narasi AI), Telegram Senin 07:00
& `/pagi`, snapshot/tool AI, maskot, simulasi rencana, notifikasi "jatah harianmu naik Rp A → Rp B".

## Belum / di luar cakupan

- Drop kolom/enum/tabel lama (`BudgetSetting.mode`/`horizonDays`, `BudgetAdvice`, jenis `IncomeKind` lama).
- Retag pemasukan lama Pasti ↔ Tambahan dari riwayat (baru bisa saat membuat pemasukan & lewat "Perlu dicek").
- Skrip prototipe yang tertanam di `.dc.html` masih versi lama (template-nya sudah baru).
