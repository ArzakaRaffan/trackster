# E01 — Parser Fixes (VA GoPay, Flip) + Perbaikan Data

**Fase 0 · 3 sesi · Permintaan #1**

> "VA ke Gopay account saya belum masuk ke log pencatatan pengeluaran di trackster"

Root cause & bukti: [findings A1, A2, A5](../01-findings.md). File utama:
`apps/backend/src/modules/gmail/parsers/{bca,flip}.parser.ts`, `parser.interface.ts`, `gmail-sync.service.ts`.

---

## E01-S1 — BCA Virtual Account

**Format email** (asli, `1a0cd11ccabac5a7`, setelah `htmlToText` jadi baris label / `:` / value):

```
Transfer Type            : Transfer to BCA Virtual Account
Source of Fund           : 6611xxxx89
BCA Virtual Account No.  : 70001081284917833
Name                     : GP-081284917833
Company/Product Name     : PT DOMPET ANAK BANGSA / GOPAY TOPUP
Pay Amount               : IDR 10,000.00
Admin Fee                : IDR 1,000.00
Total Payment            : IDR 11,000.00
Description              :
Reference No.            : 9527120260923140126797TVA4029520300
```

**Desain**
- Di `BcaParser.parse()`: kalau `transferType` mengandung `virtual account` → `parseVirtualAccount()` (cabang baru,
  jangan tambal `parseTransfer`).
- `amount` = `Total Payment` (termasuk admin fee — itu uang yang benar-benar keluar dari BCA); fallback `Pay Amount`.
- `description`:
  - Company/Product mengandung `GOPAY` → `"GoPay Top-up"`
  - lainnya → bagian setelah ` / ` dari `Company/Product Name` kalau ada, else seluruhnya, else `Name`
    (mis. `SHOPEE` VA → "Shopee"). Tambah suffix ` (VA)` seperti pola lama.
- Hint kategori: tambah field opsional `categoryHint?: Category` di `ParseResult`; GoPay → `TOPUP`
  (pipeline kategori E00-S3 memakai hint sebelum rule/AI). Kalau E00-S3 belum jalan, sementara `LAINNYA`.
- Tidak ada exclusion untuk VA (VA bukan rekening sendiri). Kalau nanti ada VA ke rekening sendiri
  (mis. top-up Jago via VA), itu masuk `isInternalDestination` — cek `Name` terhadap `OWNER_FULL_NAME`.
- `extractField` strategi 1 pakai substring (`'Name'` bisa nyangkut di `'Company/Product Name'` pada body
  plain-text). Tambah opsi exact: `extractField(body, label, { exact: true })` dan pakai untuk label pendek
  (`Name`, `Amount`, `To`, `Time`).
- Varian lain yang sudah terlihat di inbox dan harus tetap jalan: `Type of Transaction : QRIS Transfer`
  (masuk fallback, sudah OK — jangan sampai rusak), sapaan `Hi` vs `Hello`.

**Tasks**
- [x] Simpan fixture: `parsers/__fixtures__/bca-va-gopay.txt`, `bca-va-shopeepay.txt`, `bca-va-ovo.txt`, `bca-qris.txt`, `bca-qris-tokopedia.txt`, `bca-qris-shopee.txt`, `bca-qris-transfer.txt`, `bca-transfer-fliptech.txt`
- [x] `parsers/parsers.check.ts`: assert tiap fixture → amount/description/excluded yang benar (37 assertion, semua lulus)
- [x] `parseVirtualAccount()` + `categoryHint` (sementara `LAINNYA` sampai E00-S3)
- [x] Opsi `exact` di `extractField`
- [ ] Di dev: backfill 2026-08-10 → hari ini, cek berapa transaksi VA muncul (dilakukan di E01-S3)

**Acceptance:** `GoPay Top-up −Rp11.000` tanggal 23 Sep 14:01 WIB muncul di dev; fixture lain tetap lolos.

---

## E01-S2 — Flip

**Dua format email Flip** (asli):

1. Subject `Transaction information to multiple destinations` / `Transaction information…` =
   **instruksi** bayar ke rekening Flip (`Transfer Amount`, `Account Number 5465220225`, `Recipient Name PT Fliptech Lentera IP`).
   → **Abaikan** (return `null` dengan reason di EmailParseLog). Uang ke Flip sudah di-exclude dari sisi BCA (FLIPTECH).
2. Subject `Successful transfer to <Nama>. Here is the receipt.` / body `BUKTI TRANSFER` = **expense final**:
   ```
   Transaction ID              #ST260920211554466HW6K5
   Time                        20 Sep 2026 21:15 WIB
   Destination Name            Ahmad Dzulfikar As Shavy
   Destination Bank            BNI
   Destination Account Number  312500567
   Amount                      Rp64.000
   ```
   Label ini tidak dikenal parser sekarang.

**Tasks**
- [x] `htmlToText`: buang `<style>…</style>`, `<script>…</script>`, `<head>…</head>` (non-greedy, case-insensitive) sebelum proses lain — sudah dikerjakan di E01-S1
- [x] Flip: skip subject/body "Transaction information"
- [x] Flip: label `Destination Name`, `Destination Account Number`, `Destination Bank`, `Time` (dengan `exact`)
- [x] Deskripsi: `"<Destination Name> · <Bank> …<4 digit>"`; guard: deskripsi > 80 karakter atau berisi `{`/`}` → `return null` (lebih baik UNPARSED daripada sampah)
- [x] Fixture `flip-instruction.txt`, `flip-receipt.txt` + assert di `parsers.check.ts` — plus `flip-receipt-internal.txt` (transfer Flip ke rekening Blu sendiri, dari email asli 06 Sep, buat nutup kasus `isInternalDestination`)
- [ ] Kategori default transfer Flip ke nama orang → `TRANSFER` (via `categoryHint`) — **TRANSFER belum ada di enum Category** (baru MAKANAN/TRANSPORT/BELANJA/TAGIHAN/HIBURAN/KESEHATAN/LAINNYA). Sementara pakai `LAINNYA`, sama seperti pola VA GoPay di E01-S1. Nambah enum baru ditunda ke E00-S3 (biar sekalian dengan kategori lain, bukan tambal satu-satu).
- [ ] Di dev: backfill 19–21 Sep, cek 2 transaksi (Rp64.000, Rp37.500) muncul bukan 4 (dilakukan di E01-S3 bareng backfill BCA)

**Acceptance:** `parsers.check.ts` 45 assertion lulus (8 baru untuk FlipParser); backfill live di dev ditunda ke E01-S3 (satu putaran backfill buat BCA+Flip sekalian, sesuai desain S3).

---

## E01-S3 — Aturan saldo vs baseline + perbaikan data prod + backfill prod

**Aturan baru** (juga ditulis di [conventions §4](../02-conventions.md#4-saldo-recap-aturan-yang-sudah-ada--satu-aturan-baru)):
transaksi yang `occurredAt` < waktu `BalanceAdjustment` manual terakhir untuk source yang sama →
dibuat **tanpa** `adjustBalance`.

**Desain**
- `BalanceService.getLastManualAdjustmentAt(tx, source): Promise<Date | null>`.
- `TransactionService.createFromParsed()`: kalau `occurredAt < lastAdjustmentAt` → skip `adjustBalance`,
  log debug. Sama untuk jalur income otomatis nanti (E02).
- Script data repair `apps/backend/prisma/data-fixes/2026-09-flip-dedupe.sql` (bukan migration Prisma —
  dijalankan manual sekali, disimpan buat jejak):
  Isi final ada di `apps/backend/prisma/data-fixes/2026-09-flip-dedupe.sql`: DELETE id 162 & 164 (email
  instruksi Flip, saldo BCA sudah di-rebaseline 2026-09-22 03:20:34 UTC jadi hapus TANPA mengembalikan
  saldo) + UPDATE deskripsi id 161 ("Ahmad Dzulfikar As Shavy · BNI …0567") & 163 ("REYHANI INTAN SABRIN ·
  Mandiri …2442", diambil dari email `1a0b9eeadc20846a` sendiri). Semua 4 baris divalidasi read-only ke
  prod (`SELECT ... WHERE "emailId" IN (...)`) sebelum ditulis final. Guard `emailId` di WHERE supaya
  script tidak menghapus hal lain kalau id berubah.

**Langkah prod (urutan penting, minta oke Arzaka di tiap langkah):**
1. Backup: `docker exec trackster-postgres-1 pg_dump -U trackster trackster > ~/backup-$(date +%F-%H%M).sql`
2. Deploy kode E01-S1/S2/S3 (push → CD).
3. Jalankan script data-fix di atas.
4. Backfill: `POST /sync/backfill {after:"2026-08-10", before:"<besok>"}` (quiet). Dedup by `emailId` aman.
5. Cek: jumlah transaksi baru, saldo BCA sebelum vs sesudah (harus cuma berkurang sebesar transaksi VA
   **setelah** 2026-09-22 03:20 UTC — kira-kira GoPay top-up 23 Sep), EmailParseLog UNPARSED tersisa.
6. Laporkan ke Arzaka: daftar transaksi yang baru masuk + selisih saldo, minta dia bandingkan dengan saldo asli di myBCA.

**Tasks**
- [x] `getLastManualAdjustmentAt` + pakai di `createFromParsed` (+ self-check logika tanggal) — logic keputusan diekstrak jadi fungsi murni `shouldAdjustBalance()` di `balance.service.ts`, self-check di `balance.check.ts` (4 assertion: null/setelah/sebelum/tepat-sama)
- [x] Script data-fix + lengkapi deskripsi id 163 dari Gmail — dicek read-only ke prod dulu (`SELECT` by emailId), 4 baris cocok persis dengan prediksi epic. Deskripsi 163 dari email `1a0b9eeadc20846a` sendiri (bukan dari 1a0b9eddb3b43bf1 seperti draf awal — itu email instruksi 164, bukan sumber nama): "REYHANI INTAN SABRIN · Mandiri …2442"
- [ ] Eksekusi 6 langkah prod di atas bersama Arzaka — **menunggu konfirmasi, belum dijalankan**
- [x] Update `CLAUDE.md` bagian exclusion rules: tambah "email Flip 'Transaction information' = instruksi, diabaikan" dan aturan baseline saldo

**Acceptance:** saldo BCA di Trackster = saldo asli myBCA (dicek Arzaka); tidak ada deskripsi CSS; tidak ada transaksi Flip dobel.
