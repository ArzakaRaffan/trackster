# trackster — Decisions (ADR ringkas)

> Terbaru di atas. Tanggal absolut (YYYY-MM-DD). Jangan hapus yang lama.

---

## 2026-09-24 — E01-S1: VA parser BCA — cabang terpisah & guard false-positive e-wallet
**Konteks:** VA BCA (GoPay, ShopeePay, OVO, dll) tidak ter-parse karena parser lama hanya kenal `Transfer Amount` + `Beneficiary Name`. Format VA pakai `Pay Amount`/`Total Payment` + `Company/Product Name`. Tiga varian email nyata dikonfirmasi: GoPay (Name = kode VA `GP-xxx`), ShopeePay (Name = nama user ter-mask), OVO (Name = nama owner penuh `ARZAKA RAFFAN MAWARDI`).
**Keputusan:** (1) `parseVirtualAccount()` cabang terpisah, dispatch via `/virtual account/i.test(transferType)`. (2) `isInternalDestination` untuk VA hanya cek `BCA Virtual Account No.` — tidak cek `Name` vs `OWNER_FULL_NAME` karena e-wallet isi dengan nama registrasi user (OVO = false-positive). (3) `extractField` + opsi `exact: true` untuk label pendek. (4) `htmlToText` di-export dari `parser.interface.ts`, `GmailSyncService` delegate ke sana. (5) `categoryHint` di `ParseResult` sementara `LAINNYA` sampai E00-S3 perluas enum.
**Alasan:** Cabang terpisah aman; guard false-positive kritis — tanpa ini OVO top-up selalu excluded.
**Konsekuensi:** Backfill VA di E01-S3. Fixture `__fixtures__/` harus di-update kalau format email BCA berubah.

---

## 2026-09-24 — Revamp v2: rencana 10 permintaan, data benar dulu
**Konteks:** Arzaka minta 10 perubahan besar (VA GoPay, pemasukan otomatis, AI advisor + RAG, model pemasukan, fitur publik, analisis, laporan, Tanya Track, saran budget, mascot). Audit menemukan data belum bisa dipercaya: VA tidak ter-parse, Flip dobel, container UTC, 39% `LAINNYA`, pemasukan tidak dicatat sejak 24 Agu.
**Keputusan:** Rencana lengkap di `docs/revamp/` (README = index + status). Urutan: Fase 0 data benar (E00, E01) → Fase 1 pemasukan (E03, E02) → Fase 2 AI core (E04) → Fase 3 insight (E06, E07, E05) → Fase 4 mascot & publik (paralel). Angka selalu dari kode deterministik; LLM hanya memilih/menjelaskan. RAG = snapshot + memory terstruktur + Postgres FTS `indonesian` (proxy tidak punya embeddings). Pemasukan otomatis via email Jago + check-in mingguan + eksperimen iOS 27 Notification automation; Moota ditolak (biaya).
**Alasan:** Fitur pintar di atas data salah menghasilkan jawaban pintar-tapi-salah; satu user → konteks penting kecil dan selalu relevan, jadi disuntik langsung, bukan vector search.
**Konsekuensi:** Tiap sesi baca `docs/revamp/README.md` + `02-conventions.md` + satu file epic. Status di-update di README tiap sesi selesai.

---

## YYYY-MM-DD — <judul>
**Konteks:**
**Keputusan:**
**Alasan:**
**Konsekuensi:**
