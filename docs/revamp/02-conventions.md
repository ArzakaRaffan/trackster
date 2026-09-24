# Konvensi Lintas-Epic (WAJIB dibaca tiap sesi)

Melengkapi `CLAUDE.md` — bukan mengganti. Kalau bentrok, `CLAUDE.md` menang, lalu update file ini.

## 1. Lingkungan: VPS ini = PRODUCTION

- Container `trackster-backend-1`, `trackster-frontend-1`, `trackster-postgres-1` yang jalan di sini adalah prod.
- **JANGAN PERNAH** `docker compose up ...` tanpa `-f docker-compose.prod.yml` di folder ini. File dev
  (`docker-compose.yml`) punya project name & volume yang sama (`trackster_trackster_pg_data`) → bisa
  me-recreate container Postgres prod dengan config dev (lepas dari network `shared-web-net`, backend prod putus).
- DB dev yang aman — project name terpisah, port 5434:
  ```bash
  docker compose -p trackster-dev up -d postgres
  # isi dengan salinan data prod (read-only dari prod):
  docker exec trackster-postgres-1 pg_dump -U trackster --clean --if-exists trackster \
    | docker exec -i trackster-dev-postgres-1 psql -U trackster -d trackster
  # WAJIB setelah restore: matikan Telegram di dev biar nggak spam HP Arzaka
  docker exec trackster-dev-postgres-1 psql -U trackster -d trackster -c 'UPDATE "TelegramConfig" SET "isActive"=false;'
  ```
  `DATABASE_URL=postgresql://trackster:trackster@localhost:5434/trackster` di `apps/backend/.env` dev.
- Query ke prod DB boleh **read-only** (SELECT) buat investigasi. Perubahan data prod cuma lewat
  migration/script yang sudah di-review Arzaka, dan **selalu backup dulu**:
  `docker exec trackster-postgres-1 pg_dump -U trackster trackster > ~/backup-$(date +%F-%H%M).sql`
- Push ke `main` = auto-deploy (GitHub Actions). **Jangan push sebelum Arzaka bilang oke.**

## 2. Waktu: semua pakai WIB eksplisit

- Indonesia (WIB) = UTC+7, tanpa DST. Setelah E00-S1 ada helper `apps/backend/src/common/wib.ts`.
  **Semua** batas hari/minggu/bulan & kunci tanggal (`YYYY-MM-DD`) wajib lewat helper itu. Dilarang:
  `setHours(0,0,0,0)`, `getDay()`, `new Date(y, m, d)`, `toISOString().slice(0,10)` untuk logika bisnis.
- Minggu = **Senin–Minggu** (sama dengan `getWeekOverWeekTrend` sekarang). Bulan = kalender WIB.
- Cron pakai `timeZone: 'Asia/Jakarta'` (pola `ai-reports.service.ts`).

## 3. Uang & AI: angka dari kode, AI yang menjelaskan

- **LLM tidak boleh menghitung angka yang ditampilkan/disimpan.** Total, rata-rata, forecast, saran budget,
  simulasi → fungsi deterministik (bisa dites). LLM menerima hasilnya (JSON), lalu memilih, menjelaskan,
  menyesuaikan dengan konteks/memory, dan menulis narasi.
- Semua pemanggilan AI di jalur inti (sync, create transaksi, cron) **tidak boleh throw** ke atas —
  fallback deterministik + `logger.warn` (pola `AiChatService.categorize()`).
- Tier model (setelah E00-S3/E04):
  - `AI_MODEL` (default `ghrocx/sonnet-5`) — chat advisor, narasi laporan, saran budget.
  - `AI_MODEL_FAST` (default `ghrocx/haiku-4.5`) — kategorisasi, ekstraksi memory, klasifikasi pendek.
  Tambah env baru → `.env.example` + ingatkan Arzaka edit `.env` VPS manual.
- Tidak ada model embeddings di proxy (dicek 2026-09-24). Retrieval = Postgres full-text search.

## 4. Saldo (recap aturan yang sudah ada + satu aturan baru)

- Saldo cuma bergerak lewat `balanceService.adjustBalance(tx, ...)` di dalam `prisma.$transaction` yang
  sama dengan operasi utamanya. Tidak pernah dihitung ulang dari agregat.
- **Aturan baru (E01-S3):** transaksi/income yang `occurredAt`/`receivedAt`-nya **lebih lama** dari koreksi
  manual terakhir (`BalanceAdjustment`) untuk source yang sama **tidak** menggerakkan saldo — koreksi manual
  = snapshot saldo asli bank yang sudah mencakup transaksi itu. Berlaku untuk sync biasa, backfill, dan
  auto-income.
- Hapus data yang salah-parse (bukan transaksi nyata) → hapus **tanpa** restore saldo kalau sudah ada
  koreksi manual setelahnya. Tulis sebagai script/migration terpisah dengan penjelasan, bukan lewat endpoint delete biasa.

## 5. Backend

- Pola modul NestJS yang sudah ada: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`. Fitur baru = modul baru
  kalau domainnya baru (mis. `income-stream`, `report`), bukan dijejalkan ke `transaction.service.ts` yang sudah 474 baris.
- Guard: `@UseGuards(JwtAuthGuard)` per controller. Endpoint non-JWT (webhook Telegram, ingest iOS) pakai
  secret header/token sendiri, dibandingkan dengan `crypto.timingSafeEqual`.
- Migration: `npx prisma migrate dev --name <snake_case>` di DB dev. Jangan edit migration yang sudah
  ter-apply. Migration otomatis jalan di prod saat container start.
- Enum Prisma baru → cek semua `switch`/map label di frontend (mis. label kategori) ikut di-update.
- Tidak ada test framework. Logika non-trivial (parser, forecast, simulasi, pembagian split bill) wajib
  punya **satu** self-check script berbasis `assert`, jalan dengan
  `npx ts-node <path>.check.ts` (ts-node sudah ada di devDependencies). Fixture email disimpan sebagai
  `.txt` hasil `htmlToText` (tanpa data sensitif selain yang memang sudah ada di repo).

## 6. Frontend

- Data fetching: `useSWR` + `apps/frontend/src/lib/api.ts`. Tidak ada fetch langsung, tidak ada data mock.
- Token desain: `design_system/tokens/` + `tailwind.config.js` (folder aslinya `design_system/`, bukan `design-system/`).
  Satu CTA hijau per layar, satu angka `text-amount-hero` per layar, rupiah `tabular-nums` + `Rp` + `id-ID`.
- Motion: `motion/react` + token di `apps/frontend/src/lib/motion.ts` (320ms expressive, 200ms, 120ms).
  Pengecualian yang disengaja: animasi mascot (E09) boleh pakai spring/physics sendiri, tapi tetap
  hormati `useReducedMotion()`.
- Chart: `recharts` sudah terpasang — jangan tambah library chart lain. Baca skill `dataviz` sebelum bikin chart baru.
- `useSearchParams()` dibungkus `<Suspense>`.
- Halaman publik baru → daftarkan path-nya di `apps/frontend/src/middleware.ts` (daftar path publik).

## 7. Checklist verifikasi

Jalankan semua sebelum lapor selesai:

- [ ] `cd apps/backend && npm run build` lulus
- [ ] `cd apps/frontend && npx tsc --noEmit` lulus
- [ ] Self-check script yang relevan (`npx ts-node ...check.ts`) lulus
- [ ] Migration dites di DB dev (`trackster-dev`), bukan prod
- [ ] **Verifikasi hidup di browser** terhadap dev server (backend :4000, frontend :3000) dengan data salinan prod:
      buka halaman yang disentuh, klik alur utamanya, cek console & network tanpa error.
      Browser ada di laptop Arzaka → pakai tunnel: `ssh -L 3000:localhost:3000 -L 4000:localhost:4000 <vps>`,
      atau Playwright headless di VPS kalau tersedia. Screenshot hasilnya kalau bisa.
- [ ] Mobile width (≈390px) dicek untuk perubahan UI
- [ ] Tidak ada file stray (`tsconfig.tsbuildinfo`, `.bak`, dump SQL) yang ikut ke-stage

## 8. Dokumentasi

- Centang task di file epic + update tabel status `docs/revamp/README.md`.
- Keputusan teknis → `docs/context/Decisions.md` (format ADR yang sudah ada, tanggal absolut).
- Jebakan yang makan >15 menit → `docs/context/Gotchas.md`.
- Kalau arsitektur berubah (modul/tabel baru) → update `docs/context/Architecture.md`.
