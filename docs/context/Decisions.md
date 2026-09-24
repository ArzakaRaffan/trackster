# trackster — Decisions (ADR ringkas)

> Terbaru di atas. Tanggal absolut (YYYY-MM-DD). Jangan hapus yang lama.

---

## 2026-09-24 — E01-S1: VA parser BCA — cabang terpisah & guard false-positive e-wallet
**Konteks:** VA BCA (GoPay, ShopeePay, OVO, dll) tidak ter-parse karena parser lama hanya kenal `Transfer Amount` + `Beneficiary Name`. Format VA pakai `Pay Amount`/`Total Payment` + `Company/Product Name`. Tiga varian email nyata dikonfirmasi: GoPay (Name = kode VA `GP-xxx`), ShopeePay (Name = nama user ter-mask), OVO (Name = nama owner penuh `ARZAKA RAFFAN MAWARDI`).
**Keputusan:** (1) `parseVirtualAccount()` cabang terpisah, dispatch via `/virtual account/i.test(transferType)`. (2) `isInternalDestination` untuk VA hanya cek `BCA Virtual Account No.` — tidak cek `Name` vs `OWNER_FULL_NAME` karena e-wallet isi dengan nama registrasi user (OVO = false-positive). (3) `extractField` + opsi `exact: true` untuk label pendek. (4) `htmlToText` di-export dari `parser.interface.ts`, `GmailSyncService` delegate ke sana. (5) `categoryHint` di `ParseResult` sementara `LAINNYA` sampai E00-S3 perluas enum.
**Alasan:** Cabang terpisah aman; guard false-positive kritis — tanpa ini OVO top-up selalu excluded.
**Konsekuensi:** Backfill VA di E01-S3. Fixture `__fixtures__/` harus di-update kalau format email BCA berubah.

---

## 2026-09-24 — E01-S2: Flip parser — receipt vs instruksi, guard deskripsi
**Konteks:** Email Flip ada 2 bentuk: "Transaction information..." (instruksi bayar ke rekening Flip, belum expense final — uangnya baru keluar saat SoF BCA kepotong, sudah di-exclude dari sisi BCA lewat FLIPTECH) dan "Successful transfer to \<Nama\>..." (receipt = expense final, label `Destination Name`/`Destination Bank`/`Destination Account Number`/`Time`). Parser lama pakai label tebakan (`Beneficiary Name`, dll) yang tidak pernah cocok dengan email Flip asli — 3 varian dicek by ID (`ST...`/`CS...`/`FT...`, subject "BUKTI TRANSFER"/"TRANSFER RECEIPT") semua pakai label yang sama.
**Keputusan:** (1) `parse()` return `null` kalau subject match `/transaction information/i`. (2) Ganti seluruh field ke label asli dengan `exact: true`. (3) `source` selalu `BCA` (SoF cuma ada di email instruksi yang di-skip, bukan di receipt). (4) Guard deskripsi >80 char atau mengandung `{`/`}` → `null` (lebih baik UNPARSED daripada sampah). (5) `categoryHint` untuk transfer ke orang lain: enum `Category` belum punya `TRANSFER` — dipakai `LAINNYA` sementara (sama pola dengan VA GoPay di E01-S1), enum baru ditunda ke E00-S3 biar sekalian.
**Alasan:** Label tebakan tidak pernah match email nyata → semua transfer Flip selama ini UNPARSED (atau jatuh ke path lain). Ambil dari email production langsung lebih murah daripada terus nebak.
**Konsekuensi:** Fixture `flip-receipt.txt`, `flip-instruction.txt`, `flip-receipt-internal.txt` diambil dari email Gmail asli (id `1a0bf2c74c1d60d7`, `1a0bf2bbf135bd29`, `1a0783de07ac4214`). Backfill live + dedupe data lama ditunda ke E01-S3 (satu putaran bareng BCA).

---

## 2026-09-24 — Revamp v2: rencana 10 permintaan, data benar dulu
**Konteks:** Arzaka minta 10 perubahan besar (VA GoPay, pemasukan otomatis, AI advisor + RAG, model pemasukan, fitur publik, analisis, laporan, Tanya Track, saran budget, mascot). Audit menemukan data belum bisa dipercaya: VA tidak ter-parse, Flip dobel, container UTC, 39% `LAINNYA`, pemasukan tidak dicatat sejak 24 Agu.
**Keputusan:** Rencana lengkap di `docs/revamp/` (README = index + status). Urutan: Fase 0 data benar (E00, E01) → Fase 1 pemasukan (E03, E02) → Fase 2 AI core (E04) → Fase 3 insight (E06, E07, E05) → Fase 4 mascot & publik (paralel). Angka selalu dari kode deterministik; LLM hanya memilih/menjelaskan. RAG = snapshot + memory terstruktur + Postgres FTS `indonesian` (proxy tidak punya embeddings). Pemasukan otomatis via email Jago + check-in mingguan + eksperimen iOS 27 Notification automation; Moota ditolak (biaya).
**Alasan:** Fitur pintar di atas data salah menghasilkan jawaban pintar-tapi-salah; satu user → konteks penting kecil dan selalu relevan, jadi disuntik langsung, bukan vector search.
**Konsekuensi:** Tiap sesi baca `docs/revamp/README.md` + `02-conventions.md` + satu file epic. Status di-update di README tiap sesi selesai.

---

## 2026-09-24 — E00-S3: kategori final + MOBI = investasi/crypto
**Konteks:** Audit nemu `MOBI` (Rp2,62jt, 7 transaksi) nyasar ke `LAINNYA`, nggak jelas itu apa. Kategori enum sekarang cuma MAKANAN/TRANSPORT/BELANJA/TAGIHAN/HIBURAN/KESEHATAN/LAINNYA — nggak ada tempat buat transfer, top-up, atau pengeluaran sekali-jalan yang gede.
**Keputusan:** `MOBI` = investasi/crypto (dikonfirmasi Arzaka). Kategori baru yang ditambah ke enum `Category` di E00-S3: `TRANSFER`, `TOPUP` (sudah direncanakan sejak E01), `PENDIDIKAN`, `PERAWATAN`, `INVESTASI`, `ROKOK` (vape/rokok, sebelumnya default ke `HIBURAN` di draf epic — Arzaka minta kategori sendiri).
**Alasan:** Vape & investasi punya pola belanja beda (rutin kecil vs sekali gede) dari hiburan/lainnya biasa — nyampur bikin analisis pengeluaran salah baca kebiasaan.
**Konsekuensi:** `merchant-alias.category` dipakai buat rule MOBI → INVESTASI, Sigma Vape/Animo Vape → ROKOK. Semua tempat frontend yang nge-hardcode daftar kategori (label, warna, filter) perlu diupdate ikut 6 kategori baru ini.

---

## 2026-09-24 — E03-S1: IncomeStream — 5 stream aktif, Annotator/Asdos tidak dibuatkan model
**Konteks:** `Income` lama cuma entry manual datar tanpa konsep sumber/jadwal, jadi rusak begitu Arzaka berhenti rutin mencatat. Di DB lama ada entry "Annotator", "Asdos", "Kenyu" selain 5 sumber utama yang disebut Arzaka (les privat, magang, uang mingguan, Ruangguru, project). Tanya Arzaka langsung (AskUserQuestion) sebelum desain data final.
**Keputusan:** (1) 5 `IncomeStream` di-seed: Les Privat (SESSION, rate 300rb + extra 50rb offline, maks 2 sesi/minggu, `matchKeywords: ["KENYU"]` karena Kenyu = murid les aktif), Gaji Magang (DEDUCTION, maks 250rb, potong 50rb/hari absen, 5 hari kerja), Uang Mingguan Keluarga (FIXED 400rb), Ruangguru (VARIABLE, cadence MONTHLY, `payDayOfMonth=25`, estimasi awal 150rb dari rentang jawaban Arzaka 100-200rb), Project/Lainnya (IRREGULAR, cadence NONE). Semua `source: BCA`. (2) Annotator & Asdos **tidak** dibuatkan `IncomeStream` — Arzaka konfirmasi sudah tidak aktif; entry `Income` historisnya dibiarkan tanpa `streamId` (tidak di-backfill link). (3) Migration `add_income_streams` dibuat manual via `prisma migrate diff` + `migrate deploy` (bukan `migrate dev`) karena shell non-interactive tidak didukung `migrate dev`. (4) Seed pakai script sekali-jalan `prisma/seed-income-streams.ts` (idempotent by name), bukan `prisma/seed.js` (itu khusus user admin).
**Alasan:** Kolom eksplisit per `IncomeKind` (bukan JSON generik) biar UI check-in (E03-S3) & validasi DTO gampang per jenis. Stream tidak aktif tidak usah dimodelkan — cuma nambah noise di UI kelola sumber tanpa manfaat.
**Konsekuensi:** Link income lama → stream (mis. entry "Mingguan" lama → Uang Mingguan Keluarga) ditunda ke E03-S2 pas ada UI edit income yang expose `streamId`. `nest build` sempat OOM di VPS (RAM 2GB, swap penuh) — dipakai `npx tsc -p tsconfig.json` langsung buat verifikasi compile (lihat Gotchas), bukan indikasi bug kode.

---

## YYYY-MM-DD — <judul>
**Konteks:**
**Keputusan:**
**Alasan:**
**Konsekuensi:**
