# E00 — Foundation: Waktu, Log Parser, Kategori

**Fase 0 · 3 sesi · Prasyarat hampir semua epic lain**

Bukan permintaan eksplisit, tapi hasil audit ([findings A3, A4](../01-findings.md)) menunjukkan analisis,
laporan, budget, dan AI akan salah kalau tiga hal ini tidak dibereskan dulu.

---

## E00-S1 — Helper waktu WIB

**Masalah:** container UTC; 21 tempat pakai jam server untuk batas hari/minggu/bulan → transaksi
00:00–06:59 WIB masuk hari kemarin, "hari ini" ganti jam 07:00.

**Desain** — satu file `apps/backend/src/common/wib.ts`, tanpa library (WIB = UTC+7 konstan, tanpa DST):

```ts
export const WIB_OFFSET_MS = 7 * 3600_000;
export function wibDateKey(d: Date): string              // 'YYYY-MM-DD' menurut WIB
export function startOfWibDay(d: Date | string): Date     // instant UTC dari 00:00 WIB
export function addWibDays(d: Date, n: number): Date
export function wibDayOfWeek(d: Date): number             // 0=Minggu..6=Sabtu (kompatibel DailyBudget)
export function startOfWibWeek(d: Date): Date             // Senin 00:00 WIB
export function startOfWibMonth(year: number, month: number): Date // month 1-12
export function wibRange(kind: 'day'|'week'|'month', anchor: Date): { start: Date; end: Date } // end eksklusif
```

**Tasks**
- [x] Buat `wib.ts` + `wib.check.ts` (assert: 2026-09-23T17:30Z → key '2026-09-24'; 23:59 WIB masih hari yang sama;
      Senin minggu dari Minggu malam; batas bulan akhir Februari).
- [x] Ganti semua pemakaian di: `budget.service.ts` (`getTodaySummary`, `getRunwayForecast`),
      `transaction.service.ts` (`getWeekly`, `getByDay`, `getMonthly`, `getAllTimeSummary` bucket bulan,
      `getInsights`, `getWeekOverWeekTrend`, `getBudgetAdherence`, `countWeekdaysInRange`),
      `ai-reports.service.ts` (`weekStart`, cek akhir bulan), `income.service.ts`, `subscription.service.ts`
      (hitung `daysLeft`). Ditemukan tambahan yang tidak disebut eksplisit di scope awal, ikut dibenerin:
      `transaction.controller.ts` (default year/month `getMonthly` query kosong). `telegram*` sudah dicek —
      tidak ada logika boundary hari/minggu/bulan di sana (cuma format pesan). Dicari dengan:
      `grep -rn "setHours\|getDay()\|toISOString().slice(0, 10)\|new Date(year\|getFullYear()\|getMonth()" apps/backend/src`.
- [x] `AlertLog.date` — sudah otomatis benar karena sumbernya (`budgetService.getTodaySummary().date`) sekarang
      pakai `wibDateKey`, tidak perlu ubah `gmail-sync.service.ts` sendiri.
- [x] Cek frontend yang kirim tanggal ke backend — `transaction.service.ts findAll` & `income.service.ts findAll`
      (`startDate`/`endDate` query) sekarang parse via `startOfWibDay`, bukan `new Date(string)` mentah.
      `subscription.service.ts` (`nextDueDate`, `@db.Date`) sengaja TIDAK diubah — kolom itu murni tanggal
      kalender tanpa ambiguitas timezone (UTC midnight == tanggal itu sendiri).

**Acceptance**
- Transaksi jam 01:00 WIB muncul di hari yang benar di Hari Ini, Mingguan, Laporan bulanan.
- Budget harian yang dipakai = hari WIB (cek jam 06:00 WIB: harus sudah hari baru).
- Tidak ada lagi hasil grep pola terlarang di logika bisnis (boleh di helper itu sendiri).

**Jangan:** set `TZ=Asia/Jakarta` di container sebagai "fix" — kunci `toISOString()` tetap UTC dan
membuat perilaku tergantung environment. (Boleh ditambah nanti sebagai pengaman log, bukan pengganti helper.)

---

## E00-S2 — EmailParseLog: tiap email yang discan tercatat hasilnya

**Masalah:** bug VA ([A1](../01-findings.md)) berjalan berminggu-minggu tanpa ketahuan karena email yang
gagal parse cuma jadi angka `skip=N` di `EmailSyncLog.message`. Tidak ada cara lihat *email mana* yang gagal.
Juga dibutuhkan E02-S1 untuk korelasi transfer FLIPTECH yang di-exclude.

**Desain**

```prisma
enum ParseStatus { RECORDED EXCLUDED UNPARSED DUPLICATE ERROR }

model EmailParseLog {
  id          Int         @id @default(autoincrement())
  emailId     String      @unique        // Gmail message ID
  from        String
  subject     String
  receivedAt  DateTime                   // dari internalDate
  status      ParseStatus
  reason      String?                    // excludeReason / pesan error / "no parser matched"
  amount      Decimal?    @db.Decimal(12, 2)
  counterparty String?                   // beneficiary/pengirim hasil parse, kalau ada
  kind        String?                    // 'EXPENSE' | 'INCOME' (E02) — string biar fleksibel
  parser      String?                    // 'bca' | 'jago' | 'flip'
  createdAt   DateTime    @default(now())
  @@index([status])
  @@index([receivedAt])
}
```

- `GmailSyncService.syncEmails()` upsert log per message (status terakhir menang; email DUPLICATE yang sudah
  RECORDED jangan menimpa jadi DUPLICATE — cukup skip upsert kalau sudah RECORDED).
- Endpoint `GET /sync/parse-log?status=UNPARSED&limit=50` (JwtAuthGuard) di `sync.controller.ts`.
- UI: di Settings bagian Sync, tab kecil "Email yang gagal dibaca" (list subject + tanggal + reason, link
  ke Gmail `https://mail.google.com/mail/u/0/#all/<emailId>`).
- Filter penting: email promo BCA (`informasi@klikbca.com`) & notifikasi login juga akan UNPARSED — beri
  `reason` yang jelas ("bukan notifikasi transaksi") dan filter UI default hanya subject yang mirip transaksi
  (`Internet Transaction Journal`, Jago "transfer/membayar/menerima", Flip "BUKTI TRANSFER").

**Tasks**
- [x] Migration `add_email_parse_log` — dijalankan di DB dev (`trackster-dev`, port 5434), belum di prod (jalan otomatis pas backend container prod restart via `migrate deploy`)
- [x] Tulis log di `syncEmails()` (semua cabang: excluded, unparsed, dup, created, error per email) — direfactor jadi `processMessage()` + try/catch per-email (ERROR status baru: satu email error nggak lagi gagalin seluruh batch sync), aturan "RECORDED nggak boleh ketimpa" diekstrak jadi fungsi murni `shouldSkipLogUpsert()` (self-check `email-parse-log.check.ts`, 4 assertion)
- [x] Endpoint `GET /sync/parse-log?status=&limit=` + UI list (Settings → "Email yang gagal dibaca", collapsible, filter chip per status, link ke Gmail) — diverifikasi hidup: endpoint dites end-to-end (server dev + JWT asli + 2 baris `EmailParseLog` manual → response JSON benar utk status UNPARSED & RECORDED). UI belum sempat dicek visual di browser asli (VPS ini cuma 2GB RAM, prod container lagi jalan — nggak aman jalanin `next dev` bareng buat browser check tanpa tunnel dari laptop Arzaka; kode-nya ngikutin pola `BankBalanceRow` yang sudah battle-tested & `tsc --noEmit` bersih)
- [ ] Jalankan backfill 30 hari di **dev** → lihat daftar UNPARSED; catat temuan format baru di `01-findings.md` — **belum bisa**: DB dev adalah salinan data prod, tapi `GmailToken` tabelnya kosong (OAuth belum pernah di-link ke dev), jadi nggak ada cara narik email asli dari dev tanpa connect Gmail dulu. Log parse-nya sendiri sudah pasti jalan (dibuktikan manual di atas) begitu sync beneran jalan di prod.

**Acceptance:** endpoint + UI sudah ada dan terbukti benar secara mekanis (server dev + data manual). Bagian "lihat daftar UNPARSED asli dari backfill 30 hari" ditunda ke saat sync production jalan (log otomatis keisi begitu cron `gmail-sync` jalan di prod setelah deploy) — nggak butuh sesi devnya sendiri.

---

## E00-S3 — Kategori konsisten

**Masalah:** 39% pengeluaran `LAINNYA`; merchant sama dapat kategori berbeda ([A4](../01-findings.md)).

**Desain**

1. **Kategori baru** (tambah ke enum, jangan hapus yang lama):
   - `TRANSFER` — kirim uang ke orang (nama orang, bukan merchant)
   - `TOPUP` — top-up e-wallet (GoPay, OVO, ShopeePay…) — uangnya dipakai di luar pantauan
   - `PENDIDIKAN` — kuliah, kursus, buku, print
   - (opsional) `PERAWATAN` — skincare, barbershop, parfum
   Konfirmasi daftar final ke Arzaka di awal sesi (pakai AskUserQuestion), default = 3 pertama.
   Tanya juga: vape (Sigma Vape, Animo Vape) mau masuk kategori apa (default `HIBURAN`).
2. **Merchant rule** — perluas `MerchantAlias` (sudah ada, match by `rawDescription`), jangan bikin tabel baru:
   ```prisma
   model MerchantAlias {
     ...
     displayName String?     // jadi opsional
     category    Category?   // BARU: kategori tetap untuk merchant ini
   }
   ```
   plus normalisasi kunci merchant untuk varian toko: `merchantKey(desc)` = lowercase, buang digit &
   tanda baca & token `qr`, rapikan spasi, ambil ≤3 kata pertama
   (`Kopi Kenangan 1320` & `Kopi Kenangan QR BRI 1 1` → `kopi kenangan`). Simpan kolom `merchantKey` di
   `Transaction` (indexed) supaya groupBy merchant di analisis juga benar.
   `// ponytail: heuristik 3 kata, upgrade ke tabel mapping manual kalau banyak false-merge`
3. **Urutan kategorisasi di sync:** rule (by `merchantKey`) → heuristik (VA GoPay → TOPUP, nama orang tanpa
   kata merchant → TRANSFER) → AI `AI_MODEL_FAST` dengan few-shot contoh dari rule yang sudah ada →
   simpan hasil AI sebagai rule baru (supaya konsisten ke depannya).
4. **Koreksi user = belajar:** ganti kategori di detail transaksi → dialog "Terapkan ke semua transaksi
   *Kopi Kenangan* (12)?" → update rule + update transaksi lama.
5. **Halaman "Rapikan kategori"** (satu kali pakai, bisa diulang): list merchant di `LAINNYA` dikelompokkan
   per `merchantKey`, dengan saran kategori dari AI, tombol terima/ganti massal. Target: `LAINNYA` < 10%.

**Tasks**
- [ ] Tanya Arzaka: daftar kategori final + `MOBI` itu apa
- [ ] Migration: enum baru, `MerchantAlias.category`, `displayName` nullable, `Transaction.merchantKey` + backfill kolom
- [ ] `merchantKey()` + `merchant-key.check.ts`
- [ ] Pipeline kategorisasi baru di sync (rule → heuristik → AI fast → simpan rule)
- [ ] Endpoint update kategori + "terapkan ke semua"
- [ ] Halaman Rapikan kategori (di menu Lainnya)
- [ ] Update label/warna kategori di semua tempat frontend (grep `MAKANAN`)
- [ ] `AI_MODEL_FAST` di `AiService` (param `model?` opsional di `chat()`), `.env.example`

**Acceptance:** di data salinan prod, setelah "Rapikan": Kopi Kenangan/Fore/Indomaret masing-masing satu
kategori; `LAINNYA` < 10% nominal; transaksi baru dari merchant yang sudah punya rule tidak memanggil AI.
