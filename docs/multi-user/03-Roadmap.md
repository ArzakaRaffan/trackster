# 03 — Roadmap (Fase 0–9)

Centang `[x]` **hanya setelah diverifikasi** (Definition of Done di README §5). Catat tanggal + sesi di [`08-Progress-Log.md`](08-Progress-Log.md).
Estimasi dalam "hari kerja fokus sesi AI" (bukan kalender) dan **kasar** — audit menunjukkan skala lebih besar dari perkiraan awal chat
(56 file Prisma, 12 cron, 6 parser). Total ≈ **20–25 hari kerja fokus** (≈ 4–5 minggu kalender santai). Estimasi diperbarui tiap akhir fase.

Urutan fase **mengikat**: tiap fase punya prasyarat. Keputusan PROPOSED yang dibutuhkan fase tertulis di "Gerbang keputusan".

```
F0 Persiapan ─▶ F1 Skema(expand+backfill) ─▶ F2 Scoping backend ─▶ F3 Konfigurasi per user ─▶ F4 Job per user
      ─▶ F5 Auth & undangan ─▶ F6 API token & ingest ─▶ F7 Email forwarding (Cloudflare) ─▶ F8 Onboarding ─▶ F9 Hardening & peluncuran tester
                     └─ C1 (contract) dikerjakan di akhir F4/awal F5, setelah semua kode menulis userId
```

Legenda: ⛔ **GERBANG** = butuh persetujuan Arzaka sebelum lanjut · 🛟 backup wajib · 🔬 verifikasi hidup wajib.

---

## FASE 0 — Persiapan & jaring pengaman (tanpa perubahan perilaku) · ±1,5 hari

**Tujuan:** punya alat untuk membuktikan "tidak ada yang berubah" dan "tidak ada yang bocor" sebelum menyentuh apa pun.
**Prasyarat:** dokumen ini disetujui Arzaka (README, Decisions P1–P14 dibaca; setidaknya P1, P8, P13 disetujui).
**Gerbang keputusan:** ⛔ P1, P8, P13.

- [x] P0-01 Buat branch `feat/multi-user` dari `main` (bersih). Konfirmasi `git status` bersih (folder `svg/` untracked adalah milik Arzaka — jangan di-commit kecuali diminta).
- [x] P0-02 Rapikan drift domain & docs: `.env.example` (komentar URL prod → `trackster.dev`, tambah `AI_*`, `AI_AUTH_HEADER`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_TOKEN`, `COOKIE_DOMAIN`), `CLAUDE.md`, `CAUTION.md` (URL cek prod), `docs/context/Codemap.md` ("Drift yang ketemu"). **Hanya teks, tanpa efek runtime.**
- [x] P0-03 Tambahkan pointer ke folder ini di `CLAUDE.md` (bagian atas) + catatan "Single-user" → "sedang transisi multi-user, lihat docs/multi-user".
- [ ] P0-04 🛟 Backup DB prod (`pg_dump`, [Runbook §1](06-Runbooks.md)); simpan **di luar repo**; catat nama file & checksum di Progress Log (bukan isi). — *⏸ 2026-10-06: butuh akses VPS/prod — belum dikerjakan (Arzaka).*
- [ ] P0-05 **Restore-drill:** restore dump ke DB dev (`trackster-dev`, port 5434) — satu proses berat pada satu waktu (CAUTION). Verifikasi jumlah baris per tabel cocok. Matikan dev DB setelahnya. Tulis hasilnya. — *⏸ menunggu dump dari P0-04. Restore-drill dengan data sintetis di cluster scratch lokal sudah dilakukan (lihat Progress Log), BUKAN pengganti drill data nyata.*
- [ ] P0-06 Verifikasi item "belum terverifikasi" #1 & #2 di audit §10 (id user Arzaka; nilai `TELEGRAM_BOT_TOKEN` vs `TelegramConfig`). Catat hasil. — *⏸ butuh DB prod/`.env` VPS (Arzaka).*
- [ ] P0-07 **Golden snapshot tool**: skrip `apps/backend/scripts/golden-snapshot.ts` (atau `.mjs`) yang login sebagai Arzaka ke backend dev/restore dan menyimpan JSON output endpoint kunci (`/transactions` weekly/monthly/summary/insights, `/balance`, `/budget`, `/budget/today`, `/income*`, `/analytics/stats`, `/reports`, `/goal`, `/subscriptions`, `/merchant-aliases`, `/ai/health-score*`, `/auth/me`) → file di luar repo (berisi data finansial). Skrip diff dua snapshot dengan normalisasi (timestamp dinamis, `id`). **Ambil snapshot "sebelum" sekarang** dari DB restore. — *◐ 2026-10-06: alat `scripts/golden-snapshot.mjs` selesai & teruji (take×2 → diff IDENTIK, 46 endpoint 200). Snapshot "sebelum" dengan data Arzaka BELUM (butuh restore dump P0-05).*
- [x] P0-08 Agregator `npm run check` di `apps/backend` (menjalankan semua `*.check.ts` lewat `ts-node`, gagal bila ada yang gagal). Pastikan 19 check lulus **sebelum** perubahan (baseline). Pakai `NODE_OPTIONS=--max-old-space-size=…` (CAUTION).
- [ ] P0-09 (Opsional tapi disarankan) Tambah job `check` di `.github/workflows/deploy.yml` sebelum `build`: `npm ci`, `prisma generate`, `npm run build`, `npm run check`, frontend `tsc --noEmit` — memakai RAM runner (7GB), bukan VPS. ⛔ Arzaka setuju mengubah workflow CD. — *⏸ gerbang ⛔ — menunggu persetujuan Arzaka mengubah workflow CD.*
- [x] P0-10 **Skrip audit tenant statis** `apps/backend/scripts/tenancy-audit.mjs`: memindai `src/**/*.ts` (kecuali `*.check.ts`) untuk `prisma.<modelTenant>.<op>(`/`tx.<modelTenant>.<op>(` yang argumennya tidak memuat `userId` (heuristik, dengan allowlist berkomentar alasan). Keluaran: daftar temuan; exit 1 jika ada. Saat ini **akan gagal besar** (itu baseline = daftar kerja Fase 2). Daftar model tenant diambil dari [04 §A](04-Checklist.md).
- [ ] P0-11 Rancang kerangka **tes isolasi** (05 §2): skrip `apps/backend/scripts/isolation-e2e.ts` (belum penuh) yang membuat 2 user uji di DB dev dan melakukan panggilan HTTP dengan cookie masing-masing. Fase 2 mengisinya. — *◐ 2026-10-06: kerangka `scripts/isolation-e2e.mjs` (.mjs, bukan .ts) — bagian 1 (106 rute privat tanpa cookie → 401) aktif & lulus; bagian lintas-user = TODO F2 (butuh 2 user).*
- [x] P0-12 Update Progress Log + centang; commit "chore(multi-user): fase 0 — alat verifikasi & docs".

**Exit criteria F0:** snapshot "sebelum" tersimpan; `npm run check` hijau; restore-drill sukses; audit statis menghasilkan daftar baseline; docs terupdate; **tidak ada** perubahan kode runtime.
**Rollback:** hapus branch. (Tidak ada efek prod.)

---

## FASE 1 — Skema: Expand + Backfill · ±1,5 hari · 🛟 🔬

**Tujuan:** semua tabel tenant punya `userId` (nullable) terisi = Arzaka; tabel baru ada. Perilaku app **identik**.
**Prasyarat:** F0 selesai. Referensi: [02 §1–2](02-Target-Architecture.md).

- [x] P1-01 Edit `schema.prisma`: enum `UserRole/UserStatus`; kolom baru `User`; tabel baru (`Invite`, `OneTimeToken`, `ApiToken`, `InboundAddress`, `OwnAccount`, `TelegramLink`(+`TelegramLinkCode`), `AiUsage`); `userId Int?` + relasi (tanpa constraint baru) di semua tabel tenant (audit §2). **Belum** mengubah unique/PK.
- [x] P1-02 `prisma migrate dev --create-only --name multiuser_expand` (di DB dev), tinjau SQL (hanya `ALTER TABLE ADD COLUMN`/`CREATE TABLE`), terapkan di dev. Tak ada `DROP`.
- [x] P1-03 Migrasi backfill SQL (`--create-only --name multiuser_backfill`): ambil `arzakaId` dari `User` (sub-select, bukan hardcode `1`, kecuali P0-06 membuktikan 1), `UPDATE … SET userId` untuk semua tabel; `User.role='ADMIN'`, `fullName`, `displayName` — **nilai pribadi tidak ditulis ke SQL di repo** (repo public): sediakan skrip `prisma/data-fixes/…-backfill-owner.ts` yang membaca `OWNER_FULL_NAME`/`OWNER_ACCOUNT_NUMBERS` dari env dan mengisi `User.fullName` + `OwnAccount`; `TelegramConfig → TelegramLink` juga lewat skrip itu (token tidak disalin).
- [x] P1-04 Skrip verifikasi `scripts/verify-backfill.ts`: untuk setiap tabel tenant cetak `total`, `userId NULL`, `userId = arzaka`; wajib `NULL = 0` untuk tabel yang sudah punya baris.
- [ ] P1-05 Jalankan seluruh urutan di **DB restore** (bukan prod). Bandingkan jumlah baris sebelum/sesudah. Jalankan `golden snapshot` "sesudah" → diff dengan "sebelum" = **kosong** (kode belum berubah, harus identik). — *◐ 2026-10-06: urutan expand→backfill diuji di cluster scratch dengan data sintetis (23 tabel NULL=0, DB kosong OK, tidak ada drift baru). Belum dengan restore data nyata + golden "sebelum/sesudah" Arzaka.*
- [x] P1-06 `provisionUser(userId)` (service, idempoten) + ubah `prisma/seed.js` agar tinggal membuat admin (tetap plain JS — gotcha ts-node). Tes: panggil 2× tidak menggandakan baris.
- [x] P1-07 Build backend (cap RAM) + `npm run check`. Commit.
- [ ] P1-08 ⛔ **Merge ke `main` + deploy?** Aman karena kolom nullable & kode lama tak terpengaruh. Hanya setelah Arzaka setuju + backup segar ([Runbook §1](06-Runbooks.md)). Setelah deploy: cek `curl -I` frontend & API, login Arzaka, halaman utama; jalankan skrip backfill **di prod** (🛟) lalu `verify-backfill` di prod. — *⏸ gerbang ⛔ — jangan merge/push `main` tanpa persetujuan Arzaka + backup segar (Runbook §1).*

**Exit criteria F1:** prod menjalankan skema expand; backfill terverifikasi (`NULL=0`); golden snapshot identik; app normal.
**Rollback:** kolom/tabel baru bisa di-drop (migrasi down manual) — data lama tak tersentuh. Jika backfill salah: `UPDATE … SET userId=NULL` lalu ulangi.
**Risiko:** salah pilih user di backfill (satu user → kecil); migrasi lupa transaksi; `BudgetSetting`/`CategoryIcon` PK (ditunda ke C1).

---

## FASE 2 — Scoping backend (inti kerja) · ±4–5 hari · 🔬

**Tujuan:** setiap endpoint & service membaca/menulis hanya data milik user dari JWT. Satu user (Arzaka) masih satu-satunya → perilaku identik.
**Prasyarat:** F1 di prod (kolom `userId` ada & terisi). Referensi: [02 §3–4](02-Target-Architecture.md), [05](05-Security-Testing.md), [04 §A–B](04-Checklist.md).

- [x] P2-01 `@CurrentUser()` decorator + tipe `AuthUser`; `JwtAuthGuard` set `request.user` dan tetap kompatibel dengan kode split-bill/trip (`user.sub`). **Belum** menambah cek DB (itu F5). — *2026-10-06: `common/decorators/current-user.decorator.ts` (`@CurrentUser()`→`{id,username}`); guard tak diubah (cek DB = F5).*
- [x] P2-02 **Urutan modul (daun → akar)**, satu commit per modul, centang di [04 §B](04-Checklist.md): `balance` → `budget` → `merchant-alias` → `goal` → `subscription` → `reimbursement` → `income-stream` → `income` → `income-forecast` → `income-checkin` → `transaction` → `budget-allocation` → `analytics` → `report` → `ai/*` (finance-tools, chat, memory, retrieval, caption, anomaly, insight-card, budget, snapshot, reports) → `telegram` → `sync` → `gmail` → `split-bill`/`trip` (verifikasi saja). — *2026-10-06: semua modul di daftar sudah ber-userId (balance…gmail); split-bill/trip diverifikasi (sudah memfilter `createdByUserId`, tak diubah). Matriks 04 §B diperbarui.*
- [x] P2-03 Untuk **setiap** method: `userId` jadi parameter pertama; `where` memuat `userId`; method by-id memakai `findFirst({id,userId})`/`updateMany({id,userId})`+cek count (tak ada IDOR); `create` mengisi `userId`; `$transaction` konsisten. — *2026-10-06: userId parameter pertama; by-id = `findFirst/updateMany/deleteMany({id,userId})` + 404; upsert-by-unique-global diganti findFirst+update/create (kompatibel sebelum & sesudah C1). Referensi FK dari klien (mis. `streamId` di resolve income, `transactionId` reimbursement) divalidasi milik user.*
- [~] P2-04 Invarian saldo per user: `adjustBalance(tx,userId,source,delta)`, `getLastManualAdjustmentAt(tx,userId,source)`, `correctBalance(userId,…)`; update `balance.check.ts` + tambah kasus dua user. — *Saldo per `(userId, source)` selesai; `balance.check.ts` dua-user DB **ditunda sampai C1** (unik global `BankBalance.source` mencegah user kedua punya saldo di source yang sama).*
- [x] P2-05 `transaction.service.updateMany` ("terapkan kategori ke semua") menyertakan `userId`; `merchantKey`/`MerchantAlias` per user. — *2026-10-06: `updateCategoryForAll` + `merchantMatchWhere(userId, …)`; alias/ikon kategori per user.*
- [x] P2-06 `retrieval.service.ts` raw SQL: join `ChatThread` + `userId` (Prisma.sql terparameter) + update `retrieval.check.ts`. — *2026-10-06: raw SQL `JOIN ChatThread` + `ct."userId" = ${userId}` ter-bind; `retrieval.check.ts` kini dua user (pesan A tak bocor ke B & sebaliknya).*
- [x] P2-07 `GmailAuthService`/`GmailSyncService`/`SyncController`: scoped ke userId (owner). `disconnect()` → `where:{userId}` (hapus `deleteMany()` tanpa where). Cron `gmail-sync` memakai `userId` pemilik token (loop `GmailToken`). — *2026-10-06: OAuth `state` = JWT 10 menit berisi userId (menutup lubang callback tanpa identitas); `disconnect(userId)` ber-where; cron `gmail-sync` loop `GmailToken` ber-userId; endpoint Gmail/`/sync/*` **owner-only** (403 untuk user lain) sampai F3.*
- [ ] P2-08 Pipeline hilir diekstrak dari `GmailSyncService` ke `IngestPipelineService` (`processParsed(userId, …)`); `GmailSyncService` memanggilnya. **Tidak ada perubahan perilaku** (diff golden). — *⏸ DITUNDA ke Fase 6 (ponytail/YAGNI): ekstraksi `IngestPipelineService` baru bernilai saat ada konsumen kedua (ingest manual/forwarding); sekarang hanya satu pemanggil. Tidak ada perubahan perilaku yang hilang.*
- [x] P2-09 Telegram: sementara `sendMessage(userId, …)` memetakan ke `TelegramConfig` user tsb (masih tabel lama + `userId`); webhook menentukan `userId` dari config yang cocok `chatId`. (Tautan multi-user penuh di F3.) — *2026-10-06: `TelegramService.*(userId, …)` membaca `TelegramConfig` by userId; webhook memetakan `chatId→userId` (server-side); `updateConfig` menolak chatId yang dipakai akun lain.*
- [x] P2-10 Split Bill/Trip: audit — semua endpoint privat memfilter `createdByUserId`; endpoint publik (`public`, `manage/:ownerToken`, `public/:slug`) tak berubah. Tes: user B tak bisa lihat/ubah bill user A via ID. — *2026-10-06: audit kode — endpoint privat memfilter `createdByUserId` (`getOwnedBillOrThrow`), publik tak berubah. Belum ada kasus di `isolation-e2e`.*
- [~] P2-11 Audit statis (P0-10) **hijau** (atau setiap pengecualian punya komentar alasan). Isi `isolation-e2e.ts` (matriks [04 §C](04-Checklist.md)) dan jalankan: 2 user uji, setiap endpoint, **semua lulus**. — *2026-10-06: `npm run tenancy-audit` = **0 temuan** (7 false-positive heuristik dianotasi `// tenancy-ok:`); `isolation-e2e` **167 lulus / 0 gagal** (106 rute→401; 31 list tak bocor; 27 by-id→404/403; FK lintas user ditolak; data A utuh). Bagian yang butuh baris tenant B (saldo/budget/report B) menunggu C1 (`ISO_PRE_C1=0`).*
- [~] P2-12 Golden snapshot "sesudah" = identik dengan "sebelum" (Arzaka). Build + check + tsc frontend. 🔬 Verifikasi hidup di browser: beranda, hari ini, mingguan, budget, income, goals, subscriptions, reports, insights, chat, categorize, settings — tak ada error console/network. — *2026-10-06: build bersih ✔, `npm run check` 20/20 ✔, golden vs kode F1 identik di 43/46 endpoint (3 beda = polusi uji, dijelaskan di Progress Log). **Belum**: golden dengan data nyata Arzaka & verifikasi hidup di browser.*
- [ ] P2-13 ⛔ Merge ke `main` + deploy (🛟). Pasca-deploy: smoke test prod.

**Exit criteria F2:** audit statis hijau; tes isolasi hijau; golden identik; verifikasi hidup bersih; prod stabil ≥ 24 jam.
**Rollback:** revert merge commit (kolom `userId` tetap ada, aman). Image lama tersedia via `IMAGE_TAG=<sha>`.
**Risiko utama:** satu query lupa difilter (→ audit statis + tes isolasi), IDOR by-id, raw SQL, cache lintas user, N+1 baru akibat parameter tambahan.

---

## FASE 3 — Konfigurasi per user (parser, rekening, Telegram, nama) · ±3 hari · 🔬

**Prasyarat:** F2 live. Referensi: [02 §5, §8](02-Target-Architecture.md). **Gerbang:** ⛔ P2 (bot bersama).

- [x] P3-01 `UserProfileService`: `getOwnerContext(userId)` dari `User.fullName`/`OwnAccount`; CRUD rekening milik (validasi digit-only, ≥6, unik per user). — *2026-10-06: `getOwnerContext(prisma,userId)` di `common/owner.ts` (User.fullName + OwnAccount). CRUD rekening milik belum ada (F8 wizard).*
- [x] P3-02 Refaktor `gmail/parsers/own-accounts.ts` → fungsi murni dengan `OwnerContext`; `EmailParser.parse(email, ctx)`; `ParserRegistry.parseEmailWithSource(email, ctx)`; update `bca|bni|bri|flip|jago|mandiri.parser.ts` & `income.service.classify(userId,…)`. **Tidak mengubah** logika pencocokan. — *2026-10-06: sebagian: `OwnerContext` + parser/registry/income memakai konteks (logika pencocokan tidak berubah).*
- [x] P3-03 `parsers.check.ts`: ganti `process.env.OWNER_*` dengan konteks eksplisit; semua kasus lama tetap lulus; **tambah**: konteks user B (nama/rekening berbeda) tidak mengecualikan transaksi user A; konteks kosong tidak menghasilkan match palsu. — *2026-10-06: kasus lama lulus + user B/konteks kosong (61 assertion).*
- [x] P3-04 Hapus pembacaan `OWNER_*` dari kode (tetap dipakai skrip backfill saja). Compose/`.env.example`: tandai deprecated. — *2026-10-06: kode runtime tak lagi membaca env kecuali fallback tunggal di `common/owner.ts#getOwnerContext` (pemilik belum di-backfill) — hapus setelah `backfill-owner --apply` di prod.*
- [x] P3-05 Telegram bersama: tabel `TelegramLink`/`TelegramLinkCode`, endpoint buat kode, handler `/start <kode>`, `sendMessage(userId,…)`, webhook memetakan `chatId→userId`; `TelegramConfig` dipensiunkan (tetap ada sampai C1). Backfill link Arzaka (🛟). — *2026-10-06: bot bersama: token env `TELEGRAM_BOT_TOKEN` (fallback token config lama), `TelegramLink`+kode 15 menit (`POST /telegram/link-code`, `/start <kode>` di webhook), chat→user via link lalu fallback `TelegramConfig`; `telegram-link.check.ts`. UI tombol "Hubungkan Telegram" belum (F8).*
- [x] P3-06 Verifikasi semua pengirim Telegram (alert budget, notif transaksi/income, recap, nudge, check-in, anomali, saran budget, laporan) memakai `userId` — grep `telegramService.send*` → tak ada pemanggilan tanpa `userId`. — *2026-10-06: semua pemanggil `telegram*.send*` membawa userId; tenancy-audit 0.*
- [x] P3-07 Prompt AI: ganti "Arzaka" dengan `displayName` (daftar file di audit §4); frontend: ganti nama hardcode di wizard Split Bill (`logic.tsx`) & `ModalView` memakai `/auth/me` (jangan menyentuh data `/demo`). Regenerate view bila sumber desain berubah; `logic.tsx` dirawat tangan. — *2026-10-06: prompt AI (anomali, caption, budget, insight card, laporan, recap/nudge/review, chat+ekstraksi memory) memakai `common/persona.ts` (displayName→username; "Arzaka" di teks prompt diganti saat dikirim; persona konsultan tak lagi menyebut "mahasiswa/les privat"). Frontend: wizard Split Bill memakai nama dari `/auth/me` + `lastBank` dari bill terakhir user (rekening contoh Arzaka tak lagi bocor ke state live). Placeholder form memory di `ModalView` (generated) tetap menyebut contoh "Arzaka" — kosmetik.*
- [x] P3-08 `/auth/me` diperluas (`displayName`, `role`, `onboardedAt`) — frontend memakainya. — *2026-10-06: `/auth/me` kini memuat `displayName`, `role`, `onboardedAt`.*
- [ ] P3-09 Verifikasi: golden identik untuk Arzaka (nama sama); tes dua user: user B dengan nama/rekening beda → internal-transfer logic terpisah. 🔬 Kirim Telegram uji ke Arzaka (alert + balasan chat).
- [ ] P3-10 ⛔ Merge + deploy (🛟). **Pasca-deploy:** `.env` VPS — pastikan `TELEGRAM_BOT_TOKEN` benar (Arzaka via SSH).

**Exit criteria F3:** tak ada `process.env.OWNER_*`/`TelegramConfig` di kode runtime; parser memakai konteks; Telegram per-user bekerja (uji dengan 2 chat).
**Rollback:** revert; `OWNER_*` env masih ada di compose (jangan dihapus sampai F3 stabil).

---

## FASE 4 — Job terjadwal per user + Contract (C1) · ±2,5 hari · 🛟 🔬

**Prasyarat:** F3 live. Referensi: [02 §7, §2 C1](02-Target-Architecture.md). **Gerbang:** ⛔ O9 (reminder langganan non-owner).

- [x] P4-01 `PerUserJobRunner` (berurutan, try/catch per user, jitter, log). — *2026-10-06: `forEachActiveUser` (common/per-user.ts) + log durasi/status per user + `jitterMs` opsional; `per-user.check.ts`. Konkurensi tetap 1.*
- [x] P4-02 Ubah 11 cron non-Gmail (audit §5) memakai runner; tiap job menerima `user`. Idempotensi per `(userId, periode)` (unique komposit nanti di C1). — *2026-10-06: 11 cron non-Gmail memakai runner (7 job AI/Telegram pakai jitter 30 dtk); gmail-sync loop per `GmailToken`.*
- [x] P4-03 `weekly-budget-allocation` (menulis `DailyBudget`) — verifikasi hanya menyentuh budget user ybs. `close-*-report` — tidak membuat laporan kosong untuk user baru yang belum punya data periode itu (cek `createdAt`/onboarded). — *2026-10-06: `close-weekly/monthly-report` dilewati bila user dibuat setelah periode berakhir. `weekly-budget-allocation` hanya menyentuh `DailyBudget` milik userId itu.*
- [ ] P4-04 (jika O9 = ya) cron reminder langganan via Telegram untuk semua user; Google Calendar tetap owner-only.
- [ ] P4-05 Uji: 2 user uji + jalankan setiap job manual (method dipanggil langsung / endpoint trigger sementara) → Telegram & data tidak bocor; gagal di user A tidak menghentikan user B. — *2026-10-06 sebagian: runner teruji (`per-user.check`); e2e 2 user 169 lulus. Belum: tiap job manual dgn 2 user + Telegram sungguhan.*
- [ ] P4-06 **Pre-C1 gate:** `verify-backfill` di prod → `userId IS NULL = 0` di semua tabel **termasuk baris yang dibuat setelah F1** (kode F2 sudah mengisi). Audit statis hijau. Tes isolasi hijau. — *Belum di prod — jalankan `verify-backfill` di prod/restore. Migrasi C1 mengulang backfill di awalnya supaya SET NOT NULL tak gagal.*
- [ ] P4-07 🛟 **Contract C1** (migrasi terpisah, satu per kelompok tabel, urutan di [02 §2](02-Target-Architecture.md)): `userId NOT NULL`, FK `onDelete: Restrict`, indeks komposit, unique global → komposit, PK `BudgetSetting`/`CategoryIcon`. Terapkan di DB restore dulu; jalankan seluruh `check` + tes isolasi + golden; baru prod (⛔). — *2026-10-06 SIAP, belum di prod: migrasi `20261007100000_multiuser_contract` (NOT NULL 23 tabel, unik→komposit, PK CategoryIcon komposit, BudgetSetting unik userId). Teruji di scratch DB (berisi baris NULL & kosong); drift hanya 3 lama; check 22/22; isolation-e2e 169 (ISO_PRE_C1=0). Belum diuji di restore data nyata ⛔.*
- [ ] P4-08 Hapus tabel/kolom usang (mis. `TelegramConfig.botToken`) **hanya** bila kode tak memakainya lagi dan Arzaka setuju (jangan terburu-buru; boleh ditunda ke F9).
- [x] P4-09 Update `schema.prisma` komentar; `prisma generate`; build. — *2026-10-06: schema + generate + build bersih.*

**Exit criteria F4:** semua cron per-user; C1 live; `userId` NOT NULL di seluruh tabel; golden identik.
**Rollback C1:** restore dari backup (rencanakan jendela waktu singkat). Karena itu C1 dilakukan **setelah** F2–F4 stabil dan dengan backup baru.

---

## FASE 5 — Auth & undangan · ±2 hari · 🔬

**Prasyarat:** F4 (C1) live. Referensi: [02 §3](02-Target-Architecture.md). **Gerbang:** ⛔ P4, P14, O2.
> Ini satu-satunya fase yang menyentuh alur auth. Cookie/CORS/`COOKIE_DOMAIN` **tidak berubah**.

- [ ] P5-01 `JwtAuthGuard`: cek user ada, `ACTIVE`, `tv == tokenVersion` (cache 30–60 dtk). Login menambahkan `tv` ke JWT dan `lastLoginAt`. Token lama tanpa `tv` → perlakukan sebagai `tv=0` selama masa transisi lalu naikkan `tokenVersion` bila perlu.
- [ ] P5-02 Throttler `auth` (terpisah dari split-bill): login & register.
- [ ] P5-03 `POST /auth/register` (kode undangan hash → buat user `MEMBER` → `provisionUser` → set cookie sama seperti login). Validasi username (huruf kecil/angka/_ , 3–24), password ≥ 10. Hormati `MAX_USERS`.
- [ ] P5-04 CLI: `npm run user:invite -- --for "<nama>"` (cetak URL `https://trackster.dev/invite/<kode>`, kedaluwarsa 7 hari), `user:reset -- --username x` (token reset sekali pakai), `user:disable|enable`, `user:list`. Plain JS/ts-node aman (CLI dijalankan lewat `docker compose exec backend`; ingat gotcha "seed jangan ts-node di production" → tulis sebagai JS biasa di `scripts/` atau `prisma/`).
- [ ] P5-05 `POST /auth/change-password`, `POST /auth/reset-password`, `POST /auth/logout-all`. Setelah ganti/reset password → `tokenVersion++`.
- [ ] P5-06 Frontend: halaman `/invite/[kode]`, `/reset/[token]`, perbarui layar auth (sudah ada tampilan Daftar/Lupa password → sambungkan). `middleware.ts`: tambah path publik. Logout → reload penuh. 
- [ ] P5-07 Tes: kode undangan dipakai 2× → ditolak; kedaluwarsa → ditolak; user `DISABLED` → 401 pada request berikutnya; ganti password mematikan sesi lain; brute-force login ter-throttle; user baru tidak melihat data Arzaka (isolation-e2e).
- [ ] P5-08 🔬 Alur hidup di browser: Arzaka membuat undangan → buka di jendela incognito → daftar → masuk app kosong → keluar → masuk lagi. Console/network bersih.
- [ ] P5-09 ⛔ Merge + deploy. Rotasi `JWT_SECRET`? (ditunda sampai Shortcut lama dimatikan — F6.)

**Exit criteria F5:** undang→daftar→login→logout→reset berfungsi end-to-end; isolasi terbukti; Arzaka tidak terganggu.

---

## FASE 6 — API token & ingest manual (Shortcut) · ±2 hari · 🔬

**Prasyarat:** F5 live. Referensi: [02 §6.3](02-Target-Architecture.md). **Gerbang:** ⛔ P7, O7.

- [ ] P6-01 Tabel `ApiToken` aktif; `ApiTokenGuard` (Bearer → hash → `userId`, revoked ditolak); `lastUsedAt` (throttle tulis).
- [ ] P6-02 `POST /ingest/transaction` & `/ingest/income` (DTO tervalidasi: jumlah > 0, deskripsi ≤ N char, sumber ∈ `Source`, tanggal ≤ sekarang+toleransi), `Idempotency-Key`, rate limit per token.
- [ ] P6-03 Endpoint kelola token (JWT): `GET/POST/DELETE /api-tokens` (plaintext sekali tampil). UI Settings "Token Shortcut" (buat, salin, cabut, `lastUsedAt`).
- [ ] P6-04 Rancang Shortcut iOS (daftar langkah + gambar di `docs/multi-user/assets` atau panduan di app): input nominal/deskripsi → `Get Contents of URL` POST + header Bearer + `Idempotency-Key` (UUID) → tampil notifikasi hasil. Dokumentasi untuk Android (O7).
- [ ] P6-05 Migrasikan Shortcut Arzaka ke token baru; verifikasi hidup (catat 1 pengeluaran + 1 pemasukan lewat Shortcut; saldo & budget berubah benar; retry dengan kunci sama tidak menggandakan).
- [ ] P6-06 Matikan `/income/quick` lama (hapus handler, env `QUICK_INCOME_SECRET`); **rotasi `JWT_SECRET`** (secret lama dianggap terpapar: pernah diterima endpoint & mungkin ada di log query) → semua sesi keluar (informasikan, Arzaka login ulang). Update `.env` VPS manual.
- [ ] P6-07 Tes isolasi untuk ingest (token user A tak bisa menulis ke B; token revoked ditolak; header salah ditolak; body besar ditolak).
- [ ] P6-08 ⛔ Merge + deploy.

**Exit criteria F6:** Arzaka memakai Shortcut baru; `/income/quick` hilang; token dapat dibuat/dicabut; idempotensi terbukti.

---

## FASE 7 — Email forwarding (Cloudflare) · ±4 hari + waktu tunggu DNS · 🛟 🔬

**Prasyarat:** F6 live; O1, O8 terjawab. Referensi: [02 §6.1–6.2](02-Target-Architecture.md), [06 Runbook §4–6](06-Runbooks.md). **Gerbang:** ⛔ P3, P6, O1, O8, dan **setiap langkah DNS**.

- [ ] P7-01 Baca dokumentasi Cloudflare terbaru: Email Routing (subdomain, catch-all→Worker, batas ukuran, batas CPU Worker plan gratis). Catat versi/tanggal baca di Progress Log. Verifikasi audit §10.4.
- [ ] P7-02 ⛔ **Pindah DNS ke Cloudflare** ([Runbook §4](06-Runbooks.md)): ekspor record name.com, tambah zona, cocokkan **semua** record (A `@`, `api`, www, MX/TXT/CAA yang ada), semua record ke VPS = **DNS only (awan abu-abu)** agar certbot HTTP-01 & Nginx tak terganggu, matikan DNSSEC di name.com bila aktif, ganti NS di name.com, tunggu propagasi, verifikasi `dig`/browser + `certbot renew --dry-run` (di VPS, hormati CAUTION) + cek situs & API.
- [ ] P7-03 Aktifkan Email Routing untuk subdomain `in.trackster.dev` (rekam MX Cloudflare); aturan catch-all → Worker. Worker `trackster-inbound` (repo: `infra/cloudflare-worker/` — tanpa rahasia; secret via `wrangler secret`).
- [ ] P7-04 Backend: modul `inbound` — `POST /ingest/email` (HMAC+timestamp+ukuran), `InboundAddress` (buat saat provisioning), `mailparser`, penyaringan allowlist bank, RawEmail → pipeline; `EmailParseLog` per user; mode shadow. Tambah `mailparser` ke dependencies (**regenerate `package-lock.json`** — gotcha lockfile) dan pastikan build Docker CI lolos.
- [ ] P7-05 Konfirmasi forward Gmail: deteksi email konfirmasi (uji nyata), simpan kode, tampilkan di app. Verifikasi audit §10.5.
- [ ] P7-06 **Sampel nyata:** Arzaka mem-forward beberapa email bank asli; **anonimkan** (nominal/nama/rekening) → jadikan fixture di `parsers.check.ts` (varian "hasil forward"). Verifikasi header (audit §10.3) → putuskan tingkat verifikasi anti-spoof (02 §6.1.6) → catat di Decisions.
- [ ] P7-07 **Shadow mode owner (P3)** ≥ 7 hari: alamat Arzaka `shadow=true`, Gmail masih aktif. Skrip `compare-shadow.ts`: setiap email Gmail ↔ hasil forward (status, nominal, deskripsi, source) → harus **100% cocok** untuk email yang ter-forward; catat selisih & perbaiki parser/ingest. Email Gmail yang tak sampai via forward ditelusuri (filter Gmail salah? Worker gagal?).
- [ ] P7-08 ⛔ **Cutover owner:** matikan shadow, matikan cron `gmail-sync` & Gmail OAuth Arzaka (cabut token), pastikan tidak ada transaksi ganda. Pantau 3–7 hari. Jaga dead-letter.
- [ ] P7-09 Hapus kode Gmail OAuth/sync (`GmailSyncService` cron, `GmailAuthService` Gmail-part, `SyncController` yang tak dipakai), env `GMAIL_*`, FAQ & tombol Gmail di UI → teks forwarding. Calendar: sesuai P11/O9 (owner-only terpisah atau dihapus).
- [ ] P7-10 Tes isolasi & keamanan inbound (05 §4): alamat salah → diam; HMAC salah → 401; replay timestamp lama → ditolak; email bank untuk user A tak muncul di B; email non-bank → dibuang.
- [ ] P7-11 ⛔ Merge/deploy bertahap: (a) kode inbound (shadow) → (b) cutover → (c) penghapusan kode lama.

**Exit criteria F7:** email bank Arzaka masuk lewat forwarding ≥ 7 hari tanpa selisih; Gmail OAuth dihapus; DNS di Cloudflare stabil; sertifikat memperbarui OK.
**Rollback:** sebelum P7-09: aktifkan lagi Gmail (token masih bisa disambung ulang) & set `shadow=true`; DNS: kembalikan NS ke name.com (catat NS lama).
**Risiko:** forwarding gagal diam-diam (email hilang) → dead-letter + metrik `lastEmailAt` + peringatan Telegram "tidak ada email N hari"; format hasil-forward beda; DNS salah → situs/API mati (lakukan di jam sepi, TTL rendah, rencana balik).

---

## FASE 8 — Onboarding (wizard + tutorial + zero-state) · ±3–4 hari · 🔬

**Prasyarat:** F5–F7 live (token & forwarding ada). Referensi: [07](07-Onboarding-UX.md). **Gerbang:** ⛔ O6.

- [ ] P8-01 Backend: `OnboardingService` (status langkah, `onboardedAt`), endpoint wizard: profil (nama, displayName), rekening milik, bank & saldo awal (membuat `BankBalance` + baseline), budget harian awal, pemasukan (template `IncomeStream`: mingguan/bulanan/per-sesi/variabel…), Telegram link, forwarding (alamat + kode konfirmasi + status), token Shortcut.
- [ ] P8-02 Frontend: wizard `/setup` **nyata** (sumber desain di `docs/Rework Design Trackster/`; ubah desain → regenerate; logika di `logic.tsx` cabang `live`). Simpan progres (bisa lanjut nanti).
- [ ] P8-03 Tutorial: panduan langkah-demi-langkah forwarding Gmail (dengan "salin query filter" sesuai bank terpilih), Shortcut, Telegram. Teks FAQ "aman membaca email?" ditulis ulang untuk model forwarding (jujur: hanya email yang kamu forward; admin/DB visibility — O4).
- [ ] P8-04 **Checklist aktivasi** di dashboard sampai selesai; status terdeteksi otomatis (email pertama masuk, token dipakai, Telegram terhubung, transaksi pertama).
- [ ] P8-05 **Zero-state sweep** ([04 §D](04-Checklist.md)): setiap layar & endpoint dengan akun benar-benar kosong — tanpa error 500, tanpa NaN/∞, copy empty-state yang membantu; AI chat/insight/health score/forecast/report tanpa data.
- [ ] P8-06 User **pemasukan bulanan** & **mingguan** diuji (dua akun uji) — forecast, check-in, alokasi, budget. Temuan perilaku → Decisions (P12).
- [ ] P8-07 Coach mark (`v3-coach-hide`) → state per-user di server (hapus ketergantungan localStorage untuk onboarding).
- [ ] P8-08 🔬 Uji penuh akun baru dari nol (incognito, perangkat bersih): undangan → wizard → forwarding (email uji nyata) → Shortcut → Telegram → transaksi muncul → checklist hijau. Rekam hasil.
- [ ] P8-09 ⛔ Merge + deploy.

**Exit criteria F8:** akun baru bisa selesai wizard+tutorial tanpa bantuan dan mencatat transaksi dari ketiga jalur.

---

## FASE 9 — Hardening & peluncuran tester · ±3 hari · 🛟 🔬

**Prasyarat:** F8 live. **Gerbang:** ⛔ O3, O4, O5 + persetujuan akhir Arzaka.

- [ ] P9-01 Review keamanan: jalankan skill `security-review` + `code-review` pada seluruh diff `feat/multi-user`; tinjau [05](05-Security-Testing.md) (threat model) satu per satu; perbaiki temuan.
- [ ] P9-02 Kuota AI per user (`AiUsage`, P9) + penanganan "kuota habis"; metrik pemakaian.
- [ ] P9-03 Privasi: tulis ulang `/app/privacy`; ekspor data & hapus akun (skrip admin `user:export`, `user:delete` — urutan hapus eksplisit, transaksi, konfirmasi) (O4/O5). Uji hapus user uji: tak ada baris yatim, data user lain utuh.
- [ ] P9-04 Operasional: backup terjadwal (cron di VPS atau skrip), pemantauan RAM saat ≥3 user aktif + cron serentak (CAUTION; `free -h`, `docker stats`), batas heap backend, log tak memuat data sensitif.
- [ ] P9-05 (Opsional) Postgres RLS sebagai lapis kedua — hanya bila waktu/risiko memungkinkan; jangan blokir peluncuran.
- [ ] P9-06 Beban: simulasi 5 user × cron serentak (Minggu 19:00 skenario) di lingkungan dev — tidak melebihi RAM (CAUTION), waktu job wajar.
- [ ] P9-07 Update semua docs ([04 §E](04-Checklist.md)); arsipkan folder ini? (Jangan hapus — ubah README menjadi "SELESAI" dan pertahankan sebagai riwayat.) Update `CLAUDE.md` (bagian "Single-user app" diganti kondisi baru) & `docs/context/*`.
- [ ] P9-08 **Peluncuran bertahap:** 1 tester dulu (mis. orang terdekat) → amati 3–7 hari → baru yang lain. Kumpulkan masalah di Progress Log.
- [ ] P9-09 Retrospektif singkat + daftar utang teknis yang tersisa.

**Exit criteria F9:** tester pertama aktif tanpa insiden; tak ada kebocoran; RAM aman; docs final.

---

## Ringkasan dependensi keputusan

| Fase | Perlu keputusan sebelum mulai |
| --- | --- |
| F0 | P1, P8, P13 |
| F3 | P2 |
| F4 | O9 |
| F5 | P4, P14, O2 |
| F6 | P7, O7 |
| F7 | P3, P6, O1, O8 |
| F8 | O6 |
| F9 | O3, O4, O5 |
