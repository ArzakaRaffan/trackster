# E03 — Income Model: Sumber Pemasukan, Forecast, Check-in Mingguan

**Fase 1 · 3 sesi · Permintaan #4 (+ fondasi untuk #3, #9)**

> "Saya memiliki penghasilan yang sudah di-set, tapi penghasilan tersebut adalah penghasilan maksimal saya
> dalam satu minggu … Bagian Pemasukan jadi PR yang sangat besar di sini"

## Kondisi sekarang

- `Income` = daftar entry manual (amount, description, source, receivedAt). Tidak ada konsep "sumber"
  atau "jadwal". Entry terakhir 24 Agustus ([findings B](../01-findings.md#b-pemasukan-fase-1)).
- `IncomeService.getAllocationRecommendation()` & `getSmoothedDailyAllowance()` = rata-rata historis
  → rusak kalau user berhenti mencatat.

## Sumber pemasukan Arzaka (dari permintaan)

| Sumber | Pola | Maks/minggu | Variabel karena |
|---|---|---|---|
| Les privat | 150rb/jam × 2 jam × 2 sesi + transport 50rb/sesi offline | 700rb | sesi batal, sesi online (tanpa transport) |
| Gaji magang | 250rb/minggu, −50rb per hari tidak masuk | 250rb | absen |
| Uang mingguan keluarga | tetap | 400rb | — (pasti) |
| Ruangguru | bulanan, tanggal 25 | ? | nominal bulanan |
| Project software, dll | tak tentu | — | tak terduga |

Dari DB juga ada: *Annotator* (400rb), *Asdos* (540rb), *Kenyu* (700rb — murid les?). **Tanya Arzaka** di
awal E03-S1 mana yang masih aktif & masuk kategori mana.

## Desain data

```prisma
enum IncomeKind {
  FIXED      // nominal tetap (uang mingguan)
  SESSION    // per sesi + ekstra per sesi offline (les privat)
  DEDUCTION  // nominal maks dikurangi per unit absen (magang)
  VARIABLE   // nominal berubah, rutin (Ruangguru bulanan)
  IRREGULAR  // tak tentu (project) — tidak masuk forecast dasar
}
enum IncomeCadence { WEEKLY MONTHLY NONE }
enum IncomeStatus  { CONFIRMED PENDING INTERNAL } // PENDING = auto-capture perlu dicek; INTERNAL = uang masuk dari rekening sendiri (E02). Statistik cuma hitung CONFIRMED
enum IncomeOrigin  { MANUAL CHECKIN EMAIL NOTIFICATION }

model IncomeStream {
  id               Int           @id @default(autoincrement())
  name             String
  kind             IncomeKind
  cadence          IncomeCadence
  source           Source                         // rekening tujuan default
  payDayOfWeek     Int?                           // WEEKLY: 0=Min..6=Sab, hari biasanya diterima
  payDayOfMonth    Int?                           // MONTHLY: mis. 25
  amount           Decimal?  @db.Decimal(12, 2)   // FIXED: nominal; DEDUCTION: maks; VARIABLE: estimasi awal
  sessionRate      Decimal?  @db.Decimal(12, 2)   // SESSION: 300rb (150rb × 2 jam)
  sessionExtra     Decimal?  @db.Decimal(12, 2)   // SESSION: transport 50rb per sesi offline
  maxUnits         Int?                           // SESSION: maks sesi/minggu (2); DEDUCTION: hari kerja (5)
  deductionPerUnit Decimal?  @db.Decimal(12, 2)   // DEDUCTION: 50rb per hari absen
  typicalUnits     Decimal?  @db.Decimal(4, 1)    // tebakan awal sebelum ada histori (sesi biasa / absen biasa)
  matchKeywords    String[]                       // nama pengirim buat auto-link (E02), mis. ["NAMA ORTU"]
  isActive         Boolean   @default(true)
  createdAt        DateTime  @default(now())
  incomes          Income[]
}

model Income {
  ...existing
  streamId    Int?
  stream      IncomeStream? @relation(fields: [streamId], references: [id])
  periodStart DateTime?     @db.Date   // minggu (Senin) / bulan yang "dibayar" oleh income ini
  units       Decimal?      @db.Decimal(4, 1) // SESSION: sesi; DEDUCTION: hari absen
  extraUnits  Decimal?      @db.Decimal(4, 1) // SESSION: sesi offline (dapat transport)
  status      IncomeStatus  @default(CONFIRMED)
  origin      IncomeOrigin  @default(MANUAL)
  externalId  String?       @unique   // Gmail message ID / hash notifikasi → dedup auto-capture
  @@index([streamId, periodStart])
}
```

Kenapa kolom eksplisit, bukan satu kolom JSON "rules": UI check-in beda per jenis ("berapa sesi & berapa
offline?" vs "berapa hari absen?"), dan kolom eksplisit bisa divalidasi DTO. 5 jenis sudah mencakup semua
sumber yang disebut; jangan bikin engine formula generik.

## Forecast (deterministik, `income-forecast.service.ts`)

Per stream per minggu, tiga angka:

| Kind | Maks | Ekspektasi | Konservatif |
|---|---|---|---|
| FIXED | amount | amount | amount |
| SESSION | maxUnits × (rate + extra) | rata-rata aktual 8 minggu terakhir (≥3 data), else typicalUnits × (rate+extra) | minimum aktual 8 minggu terakhir, else 50% maks |
| DEDUCTION | amount | amount − rata-rata absen × deduction | amount − absen terbanyak 8 minggu × deduction |
| VARIABLE (monthly) | maks 3 bulan terakhir | rata-rata 3 bulan terakhir, else amount | minimum 3 bulan |
| IRREGULAR | — | 0 (ditampilkan terpisah sebagai "upside": rata-rata 3 bulan) | 0 |

- Stream MONTHLY cuma dihitung di minggu yang memuat `payDayOfMonth` (untuk forecast mingguan) dan dibagi
  4,33 untuk "setara per minggu" (untuk perencanaan goal).
- Output `getWeekForecast(weekStart)`:
  `{ weekStart, streams: [{ id, name, kind, conservative, expected, max, received, status: 'RECEIVED'|'PARTIAL'|'PENDING'|'MISSED' }], totals: {conservative, expected, max, received}, upsideMonthly }`
- Output `getHorizon(weeks)` untuk simulasi (E04-S4): array mingguan ke depan.
- **Ganti** `getAllocationRecommendation()` & `getSmoothedDailyAllowance()` supaya memakai forecast
  ekspektasi, bukan rata-rata historis mentah. Endpoint lama tetap ada (dipakai UI & tool AI) tapi isinya
  pakai forecast.
- `income-forecast.check.ts`: assert contoh Arzaka — maks minggu biasa = 700+250+400 = **1.350.000**;
  minggu tanggal 25 + Ruangguru.

---

## E03-S1 — Data model + seed sumber pemasukan

- [x] Tanya Arzaka (AskUserQuestion): stream aktif (Annotator? Asdos? Kenyu = les privat?), hari biasa terima
      tiap stream, rekening tujuan tiap stream, les dibayar per minggu atau per bulan, nominal Ruangguru biasanya.
      Jawaban: Kenyu = murid les privat aktif (Annotator & Asdos sudah tidak aktif, tidak dibuatkan stream);
      les dibayar per minggu; Ruangguru ~100-200rb/bulan (dipakai 150rb sebagai estimasi awal); semua stream
      source BCA.
- [x] Migration `add_income_streams` (enum + `IncomeStream` + kolom baru `Income`)
- [x] Modul baru `apps/backend/src/modules/income-stream/` (CRUD, JwtAuthGuard)
- [x] Seed/insert 5 stream sesuai jawaban (script sekali jalan `prisma/seed-income-streams.js`, idempotent by name)
- [ ] Link income lama ke stream (dialog sekali: "Mingguan" → Uang mingguan, dst.) — boleh manual lewat UI edit
      (belum ada UI edit income yang expose `streamId`; deferred ke E03-S2 saat halaman Pemasukan v2 dibuat)

## E03-S2 — Forecast + halaman Pemasukan v2

- [x] `income-forecast.service.ts` + check script (21 assertion, `npx ts-node src/modules/income-forecast/income-forecast.check.ts`)
- [x] Endpoint: `GET /income/forecast/week?date=`, `GET /income/forecast/horizon?weeks=` (modul baru `income-forecast`, terpisah dari `income`/`income-stream`)
- [x] Refactor allocation/allowance ke forecast (`IncomeService.getAllocationRecommendation()` & `getSmoothedDailyAllowance()` sekarang pakai `IncomeForecastService`, shape response tidak berubah — dipakai juga oleh `ai-finance-tools.service.ts` & `ai-mascot.service.ts`)
- [x] UI `/app/income` v2:
  - Hero: "Minggu ini **Rp X** masuk dari perkiraan Rp Y" + progress bar, baris per stream dengan status (Sudah masuk/Sebagian/Menunggu/Terlewat)
  - Kartu "Perkiraan" 3 angka (konservatif · ekspektasi · maks) minggu ini & ~4 minggu ke depan (bukan kalender bulan persis — lihat catatan di Decisions.md), dengan penjelasan satu baris
  - Kelola sumber pemasukan (list + form create/edit sesuai kind, field kondisional per `IncomeKind`)
  - Riwayat tetap grouped per bulan (entry manual, belum ada UI check-in — itu E03-S3), tag nama stream & badge status kalau bukan CONFIRMED
  - Section "Tak terduga" (IRREGULAR) tampil sebagai catatan upside terpisah di kartu Perkiraan, bukan section sendiri (lebih ringkas, jumlah stream IRREGULAR biasanya cuma satu — "Project/Lainnya")
- [x] Verifikasi di browser — dev server lokal (Postgres 16 native, bukan Docker — sandbox cloud session ini tidak punya Docker daemon) dengan data seed E03-S1, bukan salinan prod (sesi ini tidak punya akses SSH ke VPS). Login, buka `/app/income`, `/app/budget`, create/delete stream, add/delete income manual — semua lewat Playwright headless, 0 console error, 0 HTTP >=400.

## E03-S3 — Check-in mingguan

**Tujuan:** pemasukan tercatat tanpa Arzaka harus ingat buka app. Ini jaring pengaman utama (lihat
[riset](../research/income-notifications.md)).

- Cron `Minggu 19:00 WIB` (sebelum weekly report 20:00): kirim Telegram
  ```
  💰 Check-in pemasukan minggu ini (22–28 Sep)
  ✓ Uang mingguan Rp400.000 — sudah masuk (Jago, 23 Sep)
  • Magang: berapa hari absen?          [0] [1] [2] [3+]
  • Les privat: berapa sesi? (offline?)  → buka form
  Perkiraan: Rp1.350.000 · Tercatat: Rp400.000
  [Isi di web]
  ```
  Stream FIXED/DEDUCTION dijawab lewat inline keyboard (webhook Telegram sudah ada di
  `telegram-webhook.controller.ts` — tambah handler `callback_query`); SESSION & sisanya lewat link ke
  `/app/income/checkin?week=YYYY-MM-DD`.
- Halaman check-in: satu kartu per stream aktif, input stepper (sesi, sesi offline, hari absen, nominal VARIABLE),
  nominal otomatis terhitung, tombol "Simpan semua" → buat `Income` (origin CHECKIN, periodStart, units)
  dalam satu `$transaction` + `adjustBalance` (aturan baseline berlaku).
- Income yang sudah ada untuk stream+minggu itu (dari email Jago, E02) → tampil sebagai "sudah tercatat",
  tidak dobel.
- Reminder ulang Senin 12:00 kalau belum diisi (sekali saja).

- [x] Endpoint `GET /income/checkin?week=` (draft terisi: forecast + yang sudah tercatat) & `POST /income/checkin` (modul baru `income-checkin/`, reuse skema `IncomeStream`/`Income` dari E03-S1 — tidak ada migration baru)
- [x] Halaman check-in (mobile-first) — `/app/income/checkin`, stepper sesi/absen, nominal auto-hitung, link dari halaman Pemasukan
- [x] Cron (Minggu 19:00 & Senin 12:00 WIB) + pesan Telegram inline keyboard + `callback_query` handler di `telegram-webhook.controller.ts`
- [x] Tes alur penuh di dev: endpoint `GET`/`POST /income/checkin` diverifikasi end-to-end via curl ke dev DB (FIXED/DEDUCTION/SESSION dihitung benar, idempotent, saldo BCA bergerak sesuai) + self-check `income-checkin.check.ts` (15 assertion). **Belum** diverifikasi: kirim pesan Telegram nyata (nggak ada bot test tersedia sesi ini) dan browser check halaman check-in — VPS kehabisan memori berulang kali pas percobaan (lihat Gotchas.md), dev server sempat naik sekali dan konfirmasi routing/DI beres sebelum itu.

**Acceptance:** Arzaka bisa mencatat pemasukan satu minggu penuh dalam < 30 detik dari Telegram/HP;
forecast minggu depan berubah sesuai data aktual.

## Pertanyaan terbuka (default kalau tidak dijawab)

- Ada pemasukan tunai? → default: tidak, semua lewat rekening (tidak tambah `Source.CASH`).
- Les dibayar kapan? → default: per minggu, hari terakhir sesi.
- Magang 5 hari kerja/minggu? → default: ya (`maxUnits = 5`).
