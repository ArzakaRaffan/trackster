# trackster — Decisions (ADR ringkas)

> Terbaru di atas. Tanggal absolut (YYYY-MM-DD). Jangan hapus yang lama.

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
