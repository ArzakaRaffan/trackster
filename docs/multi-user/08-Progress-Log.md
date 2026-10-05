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

## 2026-10-06 — F0 (sebagian) + F1 P1-01..P1-04, P1-06, P1-07 — sesi malam, Arzaka tidur
- Sesi oleh: Claude (Sonnet 5.5)   Branch: `feat/multi-user` (turunan `main`, **belum di-push, belum merge**)   Commit terakhir: lihat `git log` (3 commit: docs, F0, F1)
- Dasar mulai: Arzaka minta "mulai dari step awal, beberapa step sekaligus". Saya menganggap itu persetujuan untuk **mulai F0/F1 di branch lokal** (P1, P8, P13 dipakai sebagai pendekatan kerja). **Status P1/P8/P13 di 00-Decisions TIDAK diubah ke LOCKED** — Arzaka masih perlu menyetujui eksplisit sebelum merge apapun.
- **Selesai (terverifikasi):**
  - P0-01 branch; P0-02 rapikan teks domain (`.env.example`, `CLAUDE.md`, `CAUTION.md`, Codemap → `trackster.dev`); P0-03 pointer (sudah ada).
  - P0-08 `npm run check` (`scripts/run-checks.mjs`): baseline **18/19 tanpa DB** (`retrieval.check.ts` butuh Postgres); **20/20 dengan DB** (+`provision-user.check.ts`).
  - P0-10 `npm run tenancy-audit`: baseline **208 temuan** di 30 file (`--summary` untuk ringkasan) = daftar kerja F2. Pengecualian sengaja: komentar `// tenancy-ok: <alasan>`.
  - P0-07 (alat) `scripts/golden-snapshot.mjs` (`take`/`diff`; 46 endpoint GET read-only, tanpa endpoint AI) — teruji: dua snapshot berturut-turut IDENTIK. P0-11 (kerangka) `scripts/isolation-e2e.mjs`: 106 rute privat tanpa cookie → 401 semua lulus.
  - P1-01/02 schema + migrasi `20261006100000_multiuser_expand` (SQL **murni tambah**: 0 DROP/SET NOT NULL/RENAME; dihasilkan `prisma migrate diff`, bukan `migrate dev`). P1-03 `20261006100100_multiuser_backfill` (UPDATE idempoten, no-op di DB kosong, tak pernah RAISE) + skrip data pribadi `prisma/data-fixes/2026-10-multiuser-backfill-owner.js` (dry-run default, `--apply`; membaca `OWNER_*` dari env; token bot tidak disalin). P1-04 `prisma/data-fixes/verify-backfill.js`. P1-06 `prisma/provision-user.js` + `seed.js` memakainya + `src/modules/user/provision-user.check.ts`.
  - Diuji di **cluster Postgres scratch lokal** (bukan prod, bukan DB dev Arzaka): DB pra-multiuser dengan data sintetis di 23 tabel → apply migrasi baru → `verify-backfill` NULL=0; deploy dari DB kosong OK; `migrate diff` tidak menunjukkan drift baru (hanya 3 drift lama: indeks tsvector/trgm raw-SQL, sama seperti sebelum perubahan); skrip owner idempoten (jalan 2× → tak ada duplikat); `seed.js` 2× idempoten; backend baru jalan di skema baru, 46 endpoint 200.
  - P1-07: build backend **bersih** (hapus `dist` + `tsconfig.tsbuildinfo` dulu) lolos; check 20/20.
- **Belum / tertunda (butuh Arzaka):**
  - P0-04 backup prod, P0-05 restore-drill data nyata, P0-06 cek id user Arzaka & token Telegram — butuh akses VPS.
  - P0-07 snapshot "sebelum" dengan data Arzaka; P1-05 uji pada restore data nyata.
  - P0-09 (job `check` di CD) ⛔ menunggu persetujuan; P1-08 merge/deploy F1 ⛔.
  - Frontend `tsc --noEmit` tidak dijalankan (tidak ada perubahan frontend).
- **Deviasi / temuan:**
  1. **Docker Desktop tidak mau start** (engine WSL berhenti; tak bisa diklik dari sesi ini). Pakai Postgres 17 native: cluster scratch `C:\tmp\pg-trackster-dev\data`, port **5434**, user/pw `trackster`, DB `trackster` (data sintetis, `owner_test`) & `trackster_empty`. Service Postgres milik Arzaka di 5432 tidak disentuh. Hidupkan: `"C:\Program Files\PostgreSQL\17\bin\pg_ctl" -D C:/tmp/pg-trackster-dev/data -o "-p 5434" start`; matikan: `... stop`. **Dimatikan di akhir sesi.**
  2. **`dist/` + `tsconfig.tsbuildinfo` basi membuat `npm run build` "lolos" tapi tidak mengeluarkan `dist/main.js`** (hanya `dist/modules`). Sebelum menganggap build valid: `rm -rf dist tsconfig.tsbuildinfo` lalu build. (Gotcha lama di CLAUDE.md, ternyata masih menggigit.)
  3. FK `SplitBill.createdByUserId`/`Trip.createdByUserId` → `User` **ditunda** (data lama bisa menyimpan id yatim → FK akan menggagalkan migrasi di prod). Tambahkan di C1 setelah dicek.
  4. `BudgetSetting` (PK singleton id=1) **tidak** dibuat oleh `provisionUser` — ditangani saat PK diubah (F2/F4). Sampai **C1** (unik global `DailyBudget.dayOfWeek`, `BankBalance.source`) user kedua **belum bisa di-provision**; urutan roadmap (C1 di akhir F4, register di F5) tetap benar.
  5. Migrasi backfill SQL **otomatis jalan saat deploy** (isi `userId` + `User.role='ADMIN'` untuk user dengan id terkecil). Baris yang dibuat kode lama sesudahnya (userId NULL) harus diisi ulang lewat skrip owner (`--apply`) sebelum F2 dan sebelum C1.
  6. `prisma format` ikut merapikan perataan model lama (diff schema lebih besar dari perubahan substansi).
  7. Skrip verifikasi ditulis `.mjs` (bukan `.ts`) agar tanpa ts-node/build; skrip yang harus jalan di container prod (`verify-backfill`, `backfill-owner`) ada di `prisma/` (satu-satunya folder selain `dist` yang disalin Dockerfile) dan plain JS.
- Keputusan baru / perubahan status: tidak ada (lihat catatan di atas soal P1/P8/P13).
- Env/aksi manual untuk Arzaka: tidak ada env baru. `.env` lokal tidak diubah.
- Docs yang diperbarui: `03-Roadmap.md` (centang + catatan), `Codemap.md`, `.env.example`, `CLAUDE.md`, `CAUTION.md`.
- **Langkah berikutnya (urut):** (1) Arzaka: setujui/tolak P1, P8, P13 di chat. (2) Arzaka/sesi dengan akses VPS: P0-04 → P0-05 → P0-06 (backup, restore ke DB dev, cek id user + token Telegram). (3) Sesi berikutnya: snapshot golden "sebelum" dari restore, ulangi P1-05 dengan data nyata, lalu minta persetujuan P1-08. (4) Setelah F1 live: mulai F2 dari `balance` (daun) — `npm run tenancy-audit -- --summary` adalah daftar kerjanya.

## 2026-10-06 (lanjutan) — F2 scoping backend (hampir semua P2-xx) — sesi malam, Arzaka tidur ("lanjutkan saja dulu")
- Sesi oleh: Claude (Sonnet 5.5)   Branch: `feat/multi-user` (belum di-push/merge)   Commit: lihat `git log` (commit "fase 2")
- Dasar: pesan Arzaka "lanjutkan saja dulu" → saya lanjut ke F2 **di branch lokal saja**. Prasyarat roadmap ("F1 sudah di prod") **belum terpenuhi**; tidak ada merge/push/DB prod. Saat Arzaka mau merge, urutannya tetap F1 dulu (P1-08), lalu F2.
- **Selesai (terverifikasi di scratch DB, bukan data nyata):** P2-01, 02, 03, 05, 06, 07, 09, 10; P2-04/11/12 sebagian (lihat Roadmap).
  - Semua service/controller tenant: `userId` parameter pertama; `@CurrentUser()` di controller; by-id memakai `findFirst/updateMany/deleteMany({id,userId})` → 404 (tidak membedakan "tak ada" vs "milik orang lain").
  - Cron (11 job non-Gmail) memakai `forEachActiveUser` (`common/per-user.ts`, versi minimal; jitter/konkurensi = F4); trigger manual (`/…/trigger-*`) hanya memproses **pemanggil**.
  - Cache `FinancialSnapshotService` yang tadinya satu-global → per user (akan bocor lintas user).
  - `/income/quick` (tanpa JWT) → user ADMIN pertama (`common/owner.ts`), dihapus F6. Gmail OAuth/`/sync/*` → **owner-only** (403 user lain) + `state` OAuth bertanda tangan.
  - Migrasi baru `20261006110000_budget_setting_id_sequence` (BudgetSetting id auto-increment, sequence disetel > MAX(id); aman untuk kode lama). `schema.prisma` ikut berubah.
  - Verifikasi: `tsc` bersih; build bersih (`dist`+`tsbuildinfo` dihapus dulu); `npm run check` 20/20 (retrieval.check kini dua user); `tenancy-audit` 208 → **0**; `isolation-e2e` **167 lulus** (dua user, A berdata/B kosong); backend boot (DI utuh); golden vs kode F1: 43/46 endpoint identik, 3 beda hanya karena data uji (dijelaskan: saldo/runway/thread dari sisa uji + baseline koreksi sintetis).
- **Temuan penting (baca!):**
  1. **Hazard pra-C1:** selama unik global masih ada (`BankBalance.source`, `DailyBudget.dayOfWeek`, `PeriodReport(period,periodStart)`, `AlertLog.date`, `HealthScoreLog/BudgetAdvice.weekStart`, `AiInsightCard`, `MerchantAlias.rawDescription`, `CategoryIcon.category`, `Transaction/Income/EmailParseLog` id email, `TelegramConfig`…), **user kedua yang menulis baris itu bisa 500 — dan bisa memblokir tulisan user pertama** (terbukti di uji: `/reports/aggregate` milik A 500 karena B lebih dulu membuat PeriodReport bulan yang sama). **Jangan membuat user kedua sebelum C1 (Fase 4).** Endpoint register belum ada (F5), jadi aman by-construction.
  2. Baris yang dibuat kode lama/F1 setelah migrasi punya `userId` NULL (terbukti: PeriodReport dibuat oleh build F1). Wajib `node prisma/data-fixes/2026-10-multiuser-backfill-owner.js --apply` (lalu `verify-backfill.js`) tepat sebelum merge F2 dan sebelum C1.
  3. Skrip owner-backfill membaca `OWNER_FULL_NAME` dari `apps/backend/.env` lewat Prisma (dotenv) — hati-hati: di mesin dev ia menulis nama pemilik asli ke DB yang sedang dipakai.
  4. Prompt AI masih menyebut "Arzaka" dan parser masih memakai `OWNER_*` env (= F3). Karena itu fitur Gmail dikunci owner-only.
  5. `alertLog` create bisa bentrok (unik global date) jika user kedua over-budget di hari yang sama — pra-C1 juga.
- **Belum / tertunda:** P2-04 (cek saldo dua-user di DB → C1), P2-08 (`IngestPipelineService` → ditunda ke F6, YAGNI), P2-12 (golden dengan data nyata Arzaka + **verifikasi hidup di browser** belum — frontend tak berubah tapi `/gmail/auth-url` kini memberi `state`, dan Telegram/cron belum diuji langsung tanpa bot), P2-13 ⛔ merge.
- **Aksi untuk Arzaka:** tidak ada env baru. Saat siap merge: backup → P1-08 → backfill-owner `--apply` → F2.
- Docs: Roadmap (centang+catatan), 04-Checklist §B (matriks), Codemap.
- **Langkah berikutnya:** (1) Arzaka setujui P1/P8/P13 + lakukan P0-04..06 (VPS). (2) Verifikasi hidup F2 di browser dengan DB hasil restore. (3) F3 (konteks pemilik parser, Telegram bersama, nama di prompt) — butuh keputusan P2 (bot bersama).
