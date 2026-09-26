# E02 — Income Auto-Capture

**Fase 1 · 2 sesi · Permintaan #2** — riset lengkap & sumber: [research/income-notifications.md](../research/income-notifications.md)

Butuh: E03-S1 (`IncomeStream.matchKeywords`, `Income.status/origin/externalId`), E00-S2 (EmailParseLog).

---

## E02-S1 — Parser email Jago "menerima uang"

**Format asli** (`1a03cc97a1b07d5c`):
```
From: noreply@jago.com
Subject: Asik, kamu telah menerima sejumlah uang💰
Kantong Jago-mu telah menerima sejumlah uang dan berikut rinciannya:
Dari              FLIPTECH LENTERA INSPIRASI PERTIWI Permata Bank • 7027730927
Ke                MA • 105602544330
Jumlah            Rp112.500
Tanggal transaksi 26 August 2026 13:37 WIB
```

**Desain**
- `ParseResult` dapat field `kind: 'EXPENSE' | 'INCOME'` (default EXPENSE, parser lama tidak berubah).
  `JagoParser.parse()`: subject/body berisi `menerima sejumlah uang` → `parseIncoming()`.
- `GmailSyncService`: `kind === 'INCOME'` → `IncomeService.createFromParsed()` (baru) — dedup via
  `Income.externalId = emailId`, `origin EMAIL`, adjust saldo JAGO (aturan baseline berlaku).
- Query Gmail sudah mencakup `from:jago` → tidak perlu diubah.
- **Link ke stream:** `Dari` (nama pengirim, uppercase) dicocokkan dengan `IncomeStream.matchKeywords`.
  Cocok → `streamId` + `periodStart` minggu berjalan, status CONFIRMED. Tidak cocok → status PENDING,
  muncul di halaman Pemasukan "Perlu dicek: Rp X dari NAMA — ini pemasukan apa?" (pilih stream / "bukan
  pemasukan (transfer internal)" / "pemasukan lain").
- **Prinsip saldo:** uang yang *benar-benar* keluar/masuk rekening selalu menggerakkan saldo; klasifikasi
  (expense / pemasukan / internal) itu urusan terpisah. Sekarang transfer internal (BCA→Jago) di-exclude
  tanpa menggerakkan saldo sama sekali → saldo per rekening drift → itu sebabnya Arzaka sering koreksi manual.
- `IncomeStatus.INTERNAL` (sudah dibuat di E03-S1). **Setiap** email Jago dana masuk → record `Income`
  (saldo JAGO +). Statusnya:
  - pengirim cocok `matchKeywords` stream → CONFIRMED + `streamId`
  - pengirim = `OWNER_FULL_NAME`, atau `FLIPTECH` yang berkorelasi dengan receipt Flip ke rekening Jago sendiri
    (EmailParseLog EXCLUDED, nominal sama persis, ±3 jam) → INTERNAL
  - selain itu (termasuk FLIPTECH tanpa korelasi — bisa jadi orang lain kirim via Flip) → PENDING
  - Statistik/forecast/laporan hanya menghitung CONFIRMED. PENDING muncul di "Perlu dicek".
- **Siapa yang menggerakkan saldo** (satu event = satu pemilik, supaya tidak dobel):

  | Event email | Klasifikasi | Saldo |
  |---|---|---|
  | BCA → FLIPTECH | exclude (SoF) | **tidak** bergerak (receipt Flip yang memegang) |
  | Flip receipt → orang lain | expense | source SoF − (seperti sekarang) |
  | Flip receipt → rekening sendiri | exclude | source SoF − **(baru, balance-only)** |
  | BCA/Jago transfer langsung → rekening sendiri | exclude | source − **(baru)**; tujuan + hanya kalau tujuan BCA (BCA tak kirim email masuk) |
  | Jago "menerima uang" | Income (CONFIRMED/INTERNAL/PENDING) | JAGO + |

  Gerakan balance-only dicatat di `EmailParseLog` (status EXCLUDED + amount) dalam `$transaction` yang sama
  sebagai jejak audit — **bukan** di `BalanceAdjustment` (itu khusus koreksi manual, lihat CLAUDE.md).
  Aturan baseline (conventions §4) tetap berlaku. Tulis tabel ini ke `CLAUDE.md` bagian Saldo setelah jalan.

**Tasks**
- [x] Ambil contoh email "menerima sejumlah uang" dari Gmail (MCP Gmail) → fixture + assert
      (cuma 2 thread nyata ada di inbox, keduanya dari FLIPTECH — fixture owner/unknown dibikin
      sintetis dari struktur HTML asli buat nutup 3 skenario klasifikasi)
- [x] `kind` di ParseResult, `JagoParser.parseIncoming()`
- [x] `IncomeService.createFromParsed()` + dedup externalId + baseline rule
- [x] Klasifikasi CONFIRMED/INTERNAL/PENDING + korelasi FLIPTECH
- [x] Gerakan saldo balance-only untuk transfer internal sesuai tabel (+ self-check skenario: top-up BCA→Jago via Flip
      harus menghasilkan BCA −x, JAGO +x, tanpa expense/pemasukan baru) — `ParseResult.balanceOnly` di
      bca/flip/jago parser + `GmailSyncService.applyBalanceOnlyDebit()`, dedup lewat EmailParseLog
- [x] UI "Perlu dicek" di halaman Pemasukan + endpoint `PATCH /income/:id/resolve`
- [x] Notif Telegram opsional "💰 Masuk Rp X dari NAMA" (ikut setting `notifyEveryTransaction`)
- [ ] Backfill 60 hari di dev → cek hasil — **belum jalan**: perlu sync Gmail beneran (butuh OAuth
      Gmail live), sengaja tidak dipicu di sesi ini biar tidak nyentuh inbox/DB prod tanpa approval eksplisit

**Acceptance:** transfer masuk ke Jago dari orang lain tercatat otomatis ≤ 5 menit; top-up BCA→Jago via Flip
tidak tercatat sebagai pemasukan tapi saldo BCA & Jago sama-sama bergerak benar.

**Rekomendasi perilaku (sampaikan ke Arzaka):** minta pembayar rutin (uang mingguan, tempat magang, wali
murid) transfer ke **rekening Jago** — itu satu-satunya bank yang kirim email dana masuk.

---

## E02-S2 — iOS 27 Shortcut: notifikasi dana masuk myBCA → Trackster (eksperimen dulu)

**Langkah 0 — eksperimen di HP (15 menit, dipandu, SEBELUM koding parser):**
1. Pastikan iPhone sudah iOS 27 (Settings → General → About). Kalau belum → berhenti, catat di riset, sesi selesai.
2. Settings → Notifications → myBCA (dan/atau BCA mobile) → Show Previews: **Always**.
3. Backend: endpoint sementara `POST /income/ingest` yang cuma **menyimpan teks mentah** (tabel
   `IngestLog { id, source, rawText, receivedAt, processed }`) — auth header `X-Ingest-Token` =
   env `INGEST_TOKEN` (bandingkan dengan `crypto.timingSafeEqual`), rate limit pakai `ThrottlerGuard` yang sudah ada.
4. Shortcuts → Automation → New → **Notification** → App: myBCA → Run Immediately →
   action "Get Contents of URL" (POST JSON `{ text: Notification, app: "myBCA" }`, header token).
5. Minta seseorang transfer Rp1 / transfer dari rekening lain → cek `IngestLog`.
6. Catat di riset: apakah automation jalan saat HP terkunci, format teks notifikasi, ada nominal & nama pengirim?

**Kalau teks memuat nominal:** lanjut ke parser
- `notification-parser.ts`: regex nominal (`Rp ?[\d.,]+`), nama pengirim, deteksi arah (masuk vs keluar — notifikasi
  keluar di-ignore karena sudah tercatat dari email).
- Buat `Income` PENDING (origin NOTIFICATION, `externalId` = hash(teks + menit)), link stream via matchKeywords
  seperti E02-S1, status CONFIRMED kalau cocok.
- Dedup silang: kalau dalam ±10 menit sudah ada income dengan nominal sama dari check-in/email → skip.
- `notification-parser.check.ts` dengan contoh teks asli dari IngestLog.

**Kalau tidak memuat nominal / tidak jalan otomatis:** tutup eksperimen, dokumentasikan, andalkan E02-S1 + E03-S3.

**Tasks**
- [ ] Endpoint ingest + IngestLog + env `INGEST_TOKEN` (`.env.example`, ingatkan edit `.env` VPS)
- [ ] Panduan Shortcut step-by-step di Settings (copyable URL & token ditampilkan sekali)
- [ ] Eksperimen bersama Arzaka, hasil dicatat di `research/income-notifications.md`
- [ ] (kondisional) parser notifikasi + check script

**Keamanan:** endpoint ingest publik (tanpa cookie) → token panjang random, throttle, payload dibatasi
(≤ 2 KB), tidak pernah mengembalikan data finansial, tidak menggerakkan saldo sampai status CONFIRMED.
