# Findings — Audit 2026-09-24

Semua poin di bawah **dicek langsung** (kode, query read-only ke DB production di VPS ini, dan email asli
di Gmail), bukan asumsi. Angka per 2026-09-24.

## A. Bug data (Fase 0)

### A1. Email BCA "Transfer to BCA Virtual Account" tidak pernah tercatat
- Email contoh: Gmail message `1a0cd11ccabac5a7` (23 Sep 2026 14:01, GoPay top-up Rp11.000).
- Field di email: `Transfer Type: Transfer to BCA Virtual Account`, `BCA Virtual Account No.`, `Name`,
  `Company/Product Name: PT DOMPET ANAK BANGSA / GOPAY TOPUP`, `Pay Amount`, `Admin Fee`, `Total Payment`.
- Root cause: `BcaParser.parseTransfer()` (`apps/backend/src/modules/gmail/parsers/bca.parser.ts`) butuh
  `Transfer Amount | Transaction Amount | Amount` **dan** `Beneficiary Name | Beneficiary | Payment to | To`.
  Email VA tidak punya satupun label itu → `return null` → dihitung "skip/unparsed" diam-diam.
- Dampak: **semua** pembayaran VA via myBCA (GoPay top-up, VA e-commerce, dll) hilang sejak awal.
  CLAUDE.md bilang "top-up GoPay via VA BCA tetap tercatat" — itu intensi, bukan kenyataan.
- Fix: E01-S1.

### A2. Flip: email instruksi pembayaran ikut dicatat → dobel + deskripsi berisi CSS
- DB: transaksi id 161–164 (19–20 Sep) deskripsinya ~1.388 karakter CSS (`...container{background:#f3f7f9...`).
- Pasangan per kejadian: id 162 (Rp64.650) + id 161 (Rp64.000) di menit yang sama; id 164 (Rp38.150) + 163 (Rp37.500).
- Email 162/164 = subject **"Transaction information to multiple destinations"** (`1a0bf2bbf135bd29`) —
  isinya *instruksi transfer ke rekening Flip* (BCA 5465220225, PT Fliptech), **bukan** transfer selesai.
  Ini harusnya diabaikan (dana ke Flip sudah di-exclude dari sisi BCA sebagai FLIPTECH).
- Email 161/163 = "BUKTI TRANSFER" (`1a0bf2c74c1d60d7`) — expense yang benar, tapi labelnya
  `Destination Name`, `Destination Account Number`, `Time`, `Amount` — parser nggak kenal
  `Destination Name`, jatuh ke `extractField('To')` yang nyangkut di baris CSS.
- `htmlToText()` di `gmail-sync.service.ts` tidak membuang isi `<style>`/`<head>`.
- Dampak: overcount **Rp102.800** + 4 deskripsi rusak. Fix: E01-S2, perbaikan data di E01-S3.

### A3. Container backend jalan di UTC, semua batas hari/minggu/bulan pakai jam server
- `docker exec trackster-backend-1 date` → UTC, `TZ` kosong. Host VPS malah `Asia/Shanghai`.
- Kode pakai `setHours(0,0,0,0)`, `getDay()`, `new Date(year, month-1, 1)`, dan kunci tanggal
  `toISOString().slice(0,10)` (21 tempat di backend).
- Dampak: transaksi 00:00–06:59 WIB masuk ke **hari sebelumnya**; "hari ini" di dashboard baru ganti jam
  07:00 WIB; minggu/bulan juga geser 7 jam; `DailyBudget` hari yang dipakai bisa salah.
- Fix: E00-S1 (helper WIB eksplisit, bukan cuma set `TZ` — kunci `toISOString()` tetap UTC).

### A4. Kategori tidak konsisten & didominasi `LAINNYA`
- `LAINNYA` = 52 transaksi, **Rp4,59jt dari Rp11,82jt (39%)** — kategori terbesar.
- Merchant sama, kategori beda: `Kopi Kenangan 1320` → MAKANAN (8x) & LAINNYA (4x); `Fore Coffee` →
  MAKANAN (7x) & LAINNYA (3x); `IDM INDOMARET D` → MAKANAN (6x) & LAINNYA (3x).
- Root cause: `AiChatService.categorize()` dipanggil ulang per transaksi tanpa ingatan per merchant;
  enum 7 kategori tidak punya tempat buat transfer ke orang, top-up e-wallet, dll.
- Top `LAINNYA`: `MOBI` Rp2,62jt (7x) — belum jelas ini apa, perlu ditanya ke Arzaka di E00-S3.
- Fix: E00-S3.

### A5. Saldo baseline vs backfill
- Koreksi saldo manual terakhir: BCA `+3.988.393` "Penyesuaian Baru" (2026-09-22 03:20 UTC).
- Koreksi manual = snapshot saldo asli bank → sudah mencakup semua transaksi sebelum waktu itu.
- Kalau backfill memasukkan transaksi VA lama (sebelum 22 Sep) dengan `adjustBalance` normal, saldo akan
  **terpotong dobel**. Aturan baru di E01-S3.

## B. Pemasukan (Fase 1)

- Tabel `Income`: 10 entry, total Rp4,0jt, **entry terakhir 2026-08-24** — sebulan nggak dicatat.
  Bukti bahwa input manual nggak jalan buat Arzaka.
- Sumber yang pernah dicatat: Project Bu Nunung (1jt), Gaji (250rb/200rb), Annotator (400rb),
  Mingguan (400rb ×2), Kenyu (700rb), Asdos (540rb), dll → lebih beragam dari 4 sumber yang disebut.
- `IncomeService.getAllocationRecommendation()` sekarang jatuh ke fallback all-time karena 28 hari
  terakhir kosong.
- **Jago mengirim email saat dana masuk**: subject `Asik, kamu telah menerima sejumlah uang💰` dari
  `noreply@jago.com` (contoh `1a03cc97a1b07d5c`: Dari FLIPTECH… Rp112.500). Belum di-parse sama sekali.
- Riset lengkap BCA/iPhone: [research/income-notifications.md](research/income-notifications.md).

## C. Budget

- `DailyBudget`: Min **0**, Sen 50rb, Sel 35rb, Rab 50rb, Kam 35rb, Jum 45rb, Sab **0** → total 215rb/minggu.
- Budget weekend 0 → tiap jajan weekend otomatis "over budget", metrik kepatuhan jadi nggak bermakna.
- Pengeluaran tercatat 10 Agu–23 Sep: Rp11,82jt / 45 hari ≈ **Rp1,84jt/minggu** vs budget 215rb/minggu.
  Sebagian besar dari pembelian besar sekali-jalan (Monitor 1,69jt, MOBI 2,62jt, Picca Steak 512rb) →
  laporan/analisis harus memisahkan **rutin vs pembelian besar** (E06-S2), kalau nggak semua angka
  "rata-rata harian" menyesatkan.

## D. Analisis & Laporan

- "30d vs All time sama aja": data baru mulai **2026-08-10** (45 hari) → all-time ≈ 30 hari. Ditambah
  `trend` (minggu ini vs minggu lalu) dan `budgetAdherence` (30 hari fix) **tidak ikut `range`** di
  `TransactionService.getInsights()`. Jadi setengah kartu memang identik.
- Tidak ada perbandingan periode (vs periode sebelumnya) di mana pun → angka tanpa konteks.
- Laporan (`/app/reports`) cuma punya bulanan + all-time + list transaksi; tidak ada mingguan/6 bulan,
  tidak ada pemasukan/net/savings rate, tidak ada narasi yang tersimpan (weekly/monthly AI cuma dikirim ke
  Telegram lalu hilang).

## E. AI / Tanya Track

- `AiService.runToolLoop()` menerima **satu** `userMessage` → model tidak pernah lihat pesan sebelumnya,
  bahkan dalam satu sesi chat. Frontend (`/app/chat`) simpan pesan di React state → hilang saat refresh.
- Tidak ada RAG sama sekali — cuma tool calling ke 7 fungsi agregat.
- Proxy AI (`api.ghrocx.my.id`) `GET /v1/models` → hanya chat model, **tidak ada embeddings**. Yang
  tersedia termasuk `ghrocx/sonnet-5` (dipakai sekarang), `ghrocx/haiku-4.5` (murah, cocok buat
  kategorisasi/ekstraksi), `ghrocx/opus-5`.
- Weekly insight & health score memakai `getInsights('30d')` → ikut kena bug A3/A4.

## F. Fitur publik

- **Bug Split Bill**: `SplitBillService.calculateTotals()` membagi pajak & service fee **rata per orang**
  (`tax / participantCount`), padahal PB1/service itu persentase dari pesanan masing-masing. Yang pesan
  es teh bayar pajak sama dengan yang pesan steak.
- Satu item cuma bisa di-assign ke satu orang (`SplitBillItem.participantId`) → nggak bisa "nasi goreng
  dibagi 3".
- Kalkulator tabungan: rumus linear (target − tabungan) / bulan, tanpa bunga/inflasi/instrumen,
  tanpa grafik, kontribusi hanya bulanan (padahal target user = pelajar dengan pemasukan mingguan).

## G. Mascot

- `TracksterMascot.tsx`: gradient radial + highlight + drop shadow (kesan "AI generated"), animasi cuma
  float/breathe/blink, ukuran 28–64px, nggak bereaksi ke apa pun selain `mood` prop. Commit `aedb476`
  sengaja mematikan path morph karena bentuk jadi "warp" → E09 pakai pendekatan prosedural yang aman.

## H. Lain-lain

- `CLAUDE.md` menyebut folder `design-system/`, yang ada di repo `design_system/`.
- `CLAUDE.md` menyuruh baca vault Second Brain di path Windows (`C:\Users\...`) — tidak bisa diakses dari
  VPS ini. Sesi di VPS pakai `docs/context/` sebagai pengganti.
- VPS ini **adalah production** (container `trackster-*` jalan di sini). Query DB dari sesi = query prod.
