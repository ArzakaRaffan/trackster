# Trackster — Project Memory

Personal finance expense tracker untuk Arzaka. Otomatis mencatat pengeluaran dari notifikasi email bank (BCA, Jago), tracking budget harian, alert Telegram, laporan & insight.

**Single-user app.** Nggak ada multi-tenant, nggak ada signup flow. Semua fitur didesain buat satu orang (Arzaka), bukan produk publik.

## Tech Stack

- Backend: NestJS + Prisma + PostgreSQL, di `apps/backend`
- Frontend: Next.js 14 App Router + Tailwind CSS + SWR, di `apps/frontend`
- Auth: JWT via httpOnly cookie (bukan localStorage)
- Deploy: Docker Compose di VPS Tencent Cloud (Jakarta), Nginx + Let's Encrypt, GitHub Actions CD auto-deploy tiap push ke `main`
- Domain: `track.trackster.my.id` (frontend), `api.track.trackster.my.id` (backend) — dua subdomain terpisah, bukan satu domain

## Struktur & Konvensi

- Tiap fitur backend = 1 module NestJS (folder di `apps/backend/src/modules/`, isi: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/` kalau perlu validasi). Ikuti pola yang sudah ada, jangan bikin struktur baru.
- Data fetching frontend SELALU lewat `useSWR` + `apps/frontend/src/lib/api.ts` — jangan fetch langsung, jangan pakai data statis/mock.
- Auth flow (middleware.ts, cookie httpOnly) sudah settled — jangan diubah tanpa alasan kuat.
- Sebelum lapor task selesai: WAJIB jalanin `npm run build` (backend) dan `tsc --noEmit` (frontend), lalu **verifikasi hidup di browser** — bukan cuma lolos compile. Riwayat project ini penuh kasus "lolos compile tapi rusak pas jalan beneran".
- Commit dengan pesan jelas per unit kerja logis (jangan 1 commit raksasa gabungan banyak hal tanpa keterangan).

## Domain Logic — Parser Email Bank

- Email BCA & Jago itu **HTML**, bukan plain text, dan strukturnya **3 kolom tabel** (label / separator ":" / value) — BUKAN format "Label: Value" satu baris. `extractField()` di `parser.interface.ts` sudah handle dua pola sekaligus (colon-inline dan label-lalu-baris-berikutnya, skip baris separator murni).
- **Exclusion rules** (transaksi yang TIDAK dihitung sebagai expense):
  - BCA transfer ke beneficiary yang mengandung "FLIPTECH" = top-up mingguan BCA→Jago via Flip (internal transfer)
  - Jago transfer ke nama yang match `OWNER_FULL_NAME` (env var) = transfer ke rekening sendiri (internal)
  - GoPay sengaja TIDAK diproses sama sekali (out of scope, topup selalu dari BCA yang sudah tercatat)
- BCA TIDAK PERNAH mengirim email notifikasi dana masuk/setor tunai (sudah diverifikasi langsung, bukan asumsi) — makanya Income untuk BCA murni manual entry, tidak ada parser buat itu.
- Deduplikasi transaksi pakai `emailId` (Gmail message ID) sebagai unique constraint.

## Domain Logic — Saldo Bank (BankBalance)

- Saldo itu **live incremental**, BUKAN dihitung ulang dari agregat total transaksi/income. Baseline di-set manual, lalu bergerak tiap ada event:
  - Transaksi expense baru (via sync) → saldo berkurang
  - Transaksi dihapus → saldo balik nambah
  - Income baru (manual) → saldo nambah
  - Income diedit/dihapus → saldo disesuaikan selisihnya
  - Koreksi manual → catat delta ke `BalanceAdjustment` (dengan note opsional)
- Semua operasi ubah saldo harus dalam Prisma transaction bareng operasi utamanya (hindari race condition saldo nggak sinkron).
- `BalanceAdjustment` log HANYA untuk koreksi manual, bukan buat tiap transaksi otomatis (itu sudah keliatan di halaman transaksi biasa).

## Gotcha Infrastruktur (jangan diulang!)

- **Prisma + Alpine**: image `node:20-alpine` butuh `RUN apk add --no-cache openssl` eksplisit di builder DAN runner stage, kalau nggak Prisma engine crash-loop dengan error samar ("Could not parse schema engine response").
- **NODE_ENV urutan penting**: `ENV NODE_ENV=production` di Dockerfile HARUS di-set SETELAH `npm install`, bukan sebelum — npm otomatis skip devDependencies kalau NODE_ENV=production sudah aktif saat install, meskipun tidak ada flag `--omit=dev` eksplisit.
- **VPS cuma 2GB RAM**: build backend+frontend paralel bisa OOM (`JavaScript heap out of memory`). Build sequential (`docker compose build backend` lalu `build frontend`, baru `up -d`), dan set `NODE_OPTIONS=--max-old-space-size=1536` di Dockerfile build stage.
- **tsconfig rootDir**: `apps/backend/tsconfig.json` harus punya `"rootDir": "./src"` dan `"include": ["src/**/*.ts"]` — kalau nggak, TypeScript ikut compile `prisma/seed.ts` dan bikin output `dist/src/main.js` bukan `dist/main.js`, sementara CMD di Dockerfile expect `node dist/main`.
- **Prisma seed jangan pakai ts-node di production** — pakai plain JS (`prisma/seed.js` + `"prisma": {"seed": "node prisma/seed.js"}` di package.json). ts-node sering konflik ESM/CJS di Node 20+ dan gampang exclude dari devDependencies pas `npm install --omit=dev`.
- **Cookie cross-subdomain**: karena frontend (`track.trackster.my.id`) dan backend (`api.track.trackster.my.id`) beda subdomain, cookie JWT butuh `domain: process.env.COOKIE_DOMAIN` (`.track.trackster.my.id`) eksplisit di `res.cookie()`, kalau nggak browser nggak nge-share cookie antar subdomain (gejala: login sukses 201 tapi langsung ke-redirect balik ke /login).
- **`useSearchParams()` di Next.js App Router** harus dibungkus `<Suspense>` kalau mau lolos `next build` (production), meskipun jalan normal di `next dev`.
- **Dockerfile naming**: file HARUS persis bernama `Dockerfile`, bukan `backend.Dockerfile` dst — kalau salah nama pas manual save dari luar, `docker compose build` gagal cari file.
- **`package-lock.json` nyimpen flag `dev` per-package terpisah dari `package.json`** — mindahin package dari devDependencies ke dependencies di `package.json` doang nggak cukup, `npm install --omit=dev` masih baca dari lockfile lama kalau nggak di-regenerate.
- **`tsconfig.tsbuildinfo` jangan sampai ke-commit** — sempat jadi biang keladi dev-server rusak berkali-kali karena cache stale ikut ke-track git. Sudah di-gitignore.

## Deployment

- CD (`.github/workflows/deploy.yml`) auto-jalan tiap push ke `main`: SSH ke VPS, `git reset --hard origin/main`, build backend lalu frontend (sequential, alasan RAM di atas), `docker compose up -d`.
- `.env` di VPS **TIDAK** di-manage lewat git/CD (sengaja, demi keamanan) — kalau nambah env var baru, harus edit manual via SSH dan restart container manual (`docker compose up -d`, bukan `--build` kalau cuma env yang berubah).
- Migration Prisma jalan otomatis tiap backend container start (`npx prisma migrate deploy` di CMD Dockerfile) — tapi **seed TIDAK otomatis**, harus manual sekali: `docker compose -f docker-compose.prod.yml exec backend npx prisma db seed`.
- SSL certificate lewat `init-letsencrypt.sh` (dummy cert dulu biar nginx bisa start, baru tukar ke certificate asli) — cuma perlu dijalanin sekali di awal atau kalau ganti domain.

## Design System

- Ada di folder `design-system/` (dari Claude Design), dengan `handoff/README.md` sebagai instruksi urutan kerja resmi buat apply ke codebase.
- Token: spacing scale 8px base, mobile gutter 16px, card gap 12px, radius/warna/tipografi custom — semua harus ditrace ke `design-system/tokens/`, jangan pakai magic number Tailwind sembarangan.
- Motion: pakai library `motion` (Framer Motion baru) + `@formkit/auto-animate`, token durasi 320ms dengan easing "ease-expressive" — konsisten dipakai di semua halaman, jangan re-invent angka baru per halaman.
