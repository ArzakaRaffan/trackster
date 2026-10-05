# 08 — Progress Log (append-only)

Setiap sesi **menambah entri di paling bawah** (jangan menulis ulang entri lama). Isi: tanggal, fase/tugas, apa selesai (dengan bukti verifikasi), apa belum,
deviasi dari rencana (+alasan), env baru yang Arzaka harus tambahkan, langkah berikutnya yang konkret. **Jangan menulis rahasia/nomor rekening/isi email/data finansial.**

**Template entri:**

```
## YYYY-MM-DD — <fase/tugas ID> — <singkat>
- Sesi oleh: <AI/Arzaka>   Branch: <nama>   Commit terakhir: <sha>
- Selesai: <ID tugas> (verifikasi: <build/check/isolasi/golden/browser>)
- Belum / tertunda: …
- Deviasi / temuan: …
- Keputusan baru atau perubahan status keputusan: … (sudah dicatat di 00-Decisions? ya/tidak)
- Env/aksi manual untuk Arzaka: …
- Docs yang diperbarui: …
- Langkah berikutnya (konkret, ≤ 2 menit untuk dimulai): …
```

---

## 2026-10-05 — Perencanaan — dokumen migrasi dibuat
- Sesi oleh: Claude (Sonnet 5.5) + Arzaka   Branch: `main` (docs saja, belum di-commit)
- Selesai: audit kode (auth, 56 file Prisma, 12 cron, parser, Telegram, Gmail OAuth, frontend wizard/auth, infra CD/Nginx/DNS) → dokumen `docs/multi-user/*` (README, 00–08).
- Temuan penting yang mengubah rencana awal:
  - Hanya `split-bill`/`trip` yang membaca `req.user`; **semua modul lain** perlu scoping dari nol → estimasi naik dari 1–1,5 minggu menjadi ±20–25 hari kerja fokus.
  - `GmailAuthService` juga melayani **Google Calendar** (reminder langganan, tidak ada reminder Telegram) → menghapus Gmail OAuth menghapus Calendar untuk user baru (P11/O9).
  - `POST /income/quick` menerima `JWT_SECRET` & `TELEGRAM_WEBHOOK_SECRET` sebagai kunci, kunci bisa lewat query string → rotasi `JWT_SECRET` setelah endpoint dihapus.
  - `GET /gmail/callback` publik tanpa `state` → siapa pun yang menyelesaikan OAuth bisa menimpa `GmailToken` (risiko sudah ada sekarang).
  - `TELEGRAM_BOT_TOKEN` diteruskan di compose tetapi tidak dibaca kode (token dibaca dari DB `TelegramConfig`).
  - `own-accounts.ts` memakai konstanta env tingkat modul; 6 parser + `income.service` memanggilnya langsung → refaktor ke konteks eksplisit.
  - `ai/retrieval.service.ts` memakai `$queryRaw` atas semua `ChatMessage` → titik kebocoran #1.
  - DNS `trackster.dev` masih di name.com (NS dicek 2026-10-05) → keputusan D3: pindah ke Cloudflare. Nginx & CD sudah memakai `trackster.dev`; `.env.example`/`CLAUDE.md`/`CAUTION.md` masih menyebut `trackster.my.id`.
  - Deploy CD tidak punya langkah tes; migrasi Prisma jalan otomatis saat container start.
- Keputusan: D1–D9 terkunci (lihat 00). P1–P14 **menunggu persetujuan Arzaka**; O1–O9 terbuka.
- Env/aksi manual: belum ada.
- Docs yang diperbarui: folder `docs/multi-user/` (baru), pointer di `CLAUDE.md`.
- Langkah berikutnya: Arzaka membaca README + 00-Decisions, menyetujui/menolak P1, P8, P13 (gerbang F0) dan menjawab O1 (DNS/DNSSEC name.com). Lalu mulai **P0-01** (branch `feat/multi-user`).
