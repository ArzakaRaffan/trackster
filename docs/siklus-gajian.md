# Siklus Gajian — Desain (belum diimplementasi)

> Status: **desain disetujui, belum ada kode.** Dibahas 2026-10-15.
> Bersinggungan dengan migrasi multi-user (schema + wizard) — baca `docs/multi-user/README.md` sebelum mulai,
> dan catat di `08-Progress-Log.md` tiap fase selesai.

## Masalah

Semua perencanaan terkunci ke **minggu Senin–Minggu**: forecast pemasukan, budget advisor, rollover, check-in
(cron Minggu 19:00), alokasi. Akibatnya untuk user gajian bulanan, forecast menaruh gaji utuh di **satu** minggu
dan 0 di minggu lain ([income-forecast.service.ts](../apps/backend/src/modules/income-forecast/income-forecast.service.ts) `isScheduledInWeek`),
jadi advisor/alokasi rusak 3 dari 4 minggu. User berpenghasilan harian/tidak tentu tidak terlayani sama sekali.

## Keputusan

| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | Periode perencanaan | **Siklus gajian** (payday → payday berikutnya), bukan minggu kalender |
| 2 | Income campuran (mingguan + bulanan) | Siklus ikut **satu income utama** (anchor). Income lain menambah "uang tersedia" saat diterima |
| 3 | Budget harian | **Dinamis**: sisa uang siklus ÷ sisa hari (berbobot hari-dalam-minggu) |
| 4 | User harian / tidak tentu | **Mode saldo**: "uangmu cukup N hari, jatah aman Rp X/hari" — tanpa input pemasukan wajib |
| 5 | Laporan mingguan Telegram (cron Minggu 20:00) | **Tetap mingguan** — itu laporan, bukan perencanaan |

## Dua mode

Ditentukan oleh satu field: `BudgetSetting.anchorStreamId`.

- **Mode SIKLUS** — `anchorStreamId` terisi, stream-nya `cadence` WEEKLY/MONTHLY.
- **Mode SALDO** — `anchorStreamId = null` (tidak punya income rutin, atau memilih begitu).

### Mode SIKLUS

```
cycleStart = payday anchor terakhir ≤ hari ini   (atau receivedAt kalau gaji masuk lebih awal)
cycleEnd   = payday anchor berikutnya

pot        = anchor            (forecast/expected; diganti nominal aktual begitu diterima)
           + income lain CONFIRMED yang diterima di [cycleStart, sekarang]
           + carry             (sisa siklus lalu, hanya kalau rolloverEnabled)
           − komitmen          (langganan jatuh tempo + kontribusi goal di [cycleStart, cycleEnd))
           − cadangan          (pot × reservePct)

sisa       = pot − pengeluaran di [cycleStart, awal hari ini)
jatah hari ini = max(0, sisa) × w[hari ini] / Σ w[d] untuk d ∈ [hari ini, cycleEnd)
```

- **Dibekukan per hari terhadap pengeluaran:** pengeluaran hari ini tidak menurunkan jatah hari ini (biar alert
  "over budget" bermakna). Income yang masuk hari ini boleh langsung menaikkan jatah.
- `sisa < 0` → jatah 0 + flag `deficit` (UI: "siklus ini sudah minus Rp X").

### Mode SALDO

```
tersedia   = Σ BankBalance + pengeluaran hari ini (dikembalikan → beku per hari)
           − komitmen 30 hari ke depan
jatah hari ini = max(0, tersedia) × w[hari ini] / Σ w selama horizonDays (default 30)
runway N   = tersedia / burn rate (reuse getRunwayForecast, burn 7 hari)
```

### Bobot hari (`w`)

`DailyBudget.amount` yang sudah ada **dipakai ulang sebagai bobot** (dinormalisasi), tanpa migrasi data. Belum
diisi / semua sama → rata. User yang dulu set weekend lebih besar otomatis tetap dapat weekend lebih besar.

## Edge case

1. **Gaji telat** (lewat payday, belum diterima): anchor tetap dihitung sebagai expected, banner "gaji belum
   masuk". Kalau stream ditandai MISSED → keluar dari pot, jatah dihitung ulang.
2. **Gaji lebih awal**: siklus baru mulai di `receivedAt`, bukan di tanggal payday.
3. **Payday tanggal 31** di bulan pendek: clamp ke hari terakhir bulan (logika ini sudah ada di forecast).
4. **Siklus pertama tanpa histori**: rumus tidak butuh histori — cukup anchor + saldo.
5. **Ganti anchor di tengah siklus**: siklus baru mulai hari itu, carry = 0.

## Dampak per module

| Module | Sekarang | Jadi |
|---|---|---|
| `budget` `getTodaySummary()` | `DailyBudget[dow] + rollover mingguan` | panggil engine siklus/saldo. **Shape return tetap** → alert, AI, mascot, ingest, email-pipeline ikut tanpa diubah |
| `budget` rollover | `calcRollover` reset Senin | dihapus; diganti `carry` antar siklus |
| `budget` advisor | bagi income minggu ke 7 hari | jadi pilihan gaya → set `reservePct` (hemat 15% / seimbang 10% / longgar 5%) |
| `income-forecast` | per `weekStart` | per `cycleStart` (anchor) |
| `income-checkin` | cron Minggu 19:00 | dipicu saat payday anchor (atau tetap mingguan untuk anchor WEEKLY) |
| `budget-allocation` | alokasi per minggu | alokasi per siklus |
| Wizard + `/app/budget` (v3) | atur nominal per hari | "Biasanya kamu terima uang kapan?" → pilih anchor / mode saldo; atur bobot hari |

## Schema (aditif, aman untuk migrate otomatis)

`BudgetSetting` tambah:

```prisma
anchorStreamId Int?               // null = mode SALDO
reservePct     Int  @default(10)  // cadangan tabungan dari pot
horizonDays    Int  @default(30)  // mode SALDO
```

Tidak ada kolom yang dihapus atau diubah tipenya.

## Fase

1. **Engine murni** — `budget-cycle.ts` (fungsi murni, tanpa DB) + `budget-cycle.check.ts` mengikuti pola
   `budget-advisor.check.ts`. Kasus uji: mingguan, bulanan, gaji telat, gaji awal, defisit, mode saldo.
2. **Sambungkan ke `getTodaySummary()`** + migration 3 kolom. User yang sudah ada: anchor di-set ke stream
   WEEKLY aktif mereka → angka mendekati perilaku lama.
3. **Forecast, check-in, allocation** pindah ke siklus. Hapus rollover mingguan.
4. **UI v3** — layar Budget (anchor, gaya, bobot hari), Beranda (jatah hari ini + sisa siklus + "gajian N hari
   lagi"), pertanyaan wizard.
5. **Docs** — update `CLAUDE.md` (domain logic budget), `docs/context/Codemap.md`, Progress Log multi-user.

## Pembelian besar (`isBig`)

Diputuskan 2026-10-15. Deteksi pakai `isBigPurchase()` yang sama dengan analytics (flag manual `isBig` atau
otomatis vs median 90 hari).

- **Tetap mengurangi pot** — uangnya memang keluar, jatah hari-hari berikutnya ikut turun.
- **Tidak dihitung di alert "over budget hari ini"** — alert harian untuk kebiasaan kecil; kalau ikut, dampaknya
  dihitung dua kali dan bikin alert fatigue.
- **Gantinya notifikasi dampak:** "Pembelian besar Rp X tercatat — jatah harianmu turun dari Rp A ke Rp B sampai
  gajian." Ini sekaligus menutup celah user menandai apa saja sebagai besar demi menghindari alert.

## Progres

- [x] Fase 1 — `apps/backend/src/modules/budget/budget-cycle.ts` + `budget-cycle.check.ts` (18 kasus; 23 setelah fase 3).
- [x] Fase 2 — kolom `mode` (default **FIXED** = perilaku lama, supaya merge tidak mengubah angka tester) + `anchorStreamId`/
  `reservePct`/`horizonDays` (migrasi aditif `20261015100000_budget_cycle_mode`), `GET/PUT /budget/settings`, `getTodaySummary()`
  memanggil engine; respons bertambah `mode`, `bigSpent`, `cycle`. Expected anchor = rata-rata 3 pembayaran terakhir (fallback
  konfigurasi stream).

- [x] Fase 3 — semua perilaku hanya berubah untuk mode CYCLE/BALANCE:
  1. Tabel `DailyAllowance` (migrasi aditif `20261016100000_daily_allowance`): snapshot jatah per hari, ditulis `getTodaySummary()` +
     cron `daily-allowance-snapshot` 00:05 WIB. Analytics (kepatuhan, health score, laporan) memakai snapshot; hari tanpa snapshot
     (= mode FIXED saat itu) tetap pakai nominal `DailyBudget`.
  2. Carry antar siklus bila `rolloverEnabled` (satu tingkat: pemasukan nyata siklus lalu − cadangan − belanja).
  3. Anchor dicatat Rp0 (check-in "tidak dapat") = MISSED → `anchorReceived` 0. `cycle.anchorPending` = siklus sudah jalan, gaji belum tercatat.
  4. Cron alokasi mingguan (Minggu 21:00) dilewati — dulu menimpa `DailyBudget` (= bobot hari) jadi rata.
  5. `POST /budget/apply` (hemat/seimbang/longgar) mengatur `reservePct` (15/10/5, `RESERVE_PCT`), bukan nominal harian.
  6. Telegram: alert over-budget memakai belanja rutin; pembelian besar → `sendBigPurchaseNotice` ("jatah N hari ke depan A → B").
  7. Median ambang "besar" disamakan dengan analytics (90 hari s.d. akhir hari ini) supaya budget & Analisis sepakat.
- Tidak dikerjakan (sengaja): kontribusi goal sebagai komitmen (tabungan sudah tercakup `reservePct`; Goal tidak punya target per
  periode); check-in tetap mingguan (sudah hanya menanyakan stream bulanan di minggu payday-nya); forecast mingguan tetap untuk
  check-in & advisor FIXED.

- [x] Fase 4 — UI v3 (markup di `.dc.html` → `node scripts/dc-to-tsx.mjs`; logika di `logic.tsx`; data di `useLive.ts`):
  1. **Hari ini & Beranda:** "lewat budget" memakai belanja tanpa pembelian besar (`todayBig` = `bigSpent`); baris info
     `hero.cycleTxt` ("Sisa Rp X sampai gajian · gajian N hari lagi · gaji belum tercatat" / "Saldo tersedia … · cukup ±N hari").
     Net hari ini tetap memakai seluruh belanja.
  2. **Budget:** bagian "Cara menghitung budget" (Tetap per hari / Ikut gajian / Dari saldo, pemasukan utama, sisihkan 5/10/15%,
     `PUT /budget/settings`). Mode dinamis: hero "Jatah hari ini", strip = bobot %, tombol "Atur bobot hari"; kartu 50/30/20 &
     "Saran minggu ini" disembunyikan.
  3. **Mingguan:** budget per tanggal = `dynamicBudgetOf()` (`live/dates.ts`): hari lalu = snapshot `GET /budget/allowances`
     (tanpa snapshot → nominal), hari ini & ke depan = jatah hari ini.
  4. **Wizard langkah 7:** "Biasanya kamu terima uang kapan?" Mingguan/Bulanan → stream "Pemasukan utama" (FIXED, aktif) + mode
     CYCLE; Tidak tentu → BALANCE; tidak dipilih → mode tetap + slider lama. Disimpan sebelum onboarding ditandai selesai.
  5. EN: kamus `CYC_EN` (teks statis); teks berangka dibuat dua bahasa di render.

- [x] Siklus pertama (keputusan Arzaka 2026-10-16) — akun dibuat setelah `cycleStart`:
  - saldo pernah dikoreksi manual (`BalanceAdjustment` ada) → sisa uang siklus = saldo awal hari ini (saldo + belanja hari ini),
    tanpa cadangan/carry; `cycle.firstCycle = 'BALANCE'`, UI "siklus pertama: dihitung dari saldo";
  - saldo belum pernah diisi (user baru = 0) → tetap perkiraan gaji, `firstCycle = 'ESTIMATE'`, UI mengajak isi saldo di Setting → Saldo bank;
  - `anchorPending` tidak menyala di siklus pertama (gajinya masuk sebelum daftar).

### Masih terbuka

- Layar Mingguan mewarnai hari "lewat" dari total belanja (termasuk pembelian besar), beda dengan Hari ini/Analisis (belanja rutin).
