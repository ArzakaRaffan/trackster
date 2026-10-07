# Trackster — Project Memory

Personal finance expense tracker untuk Arzaka. Otomatis mencatat pengeluaran dari notifikasi email bank (BCA, Jago), tracking budget harian, alert Telegram, laporan & insight.

**Single-user app (saat ini) — sedang direncanakan migrasi ke multi-user invite-only.** Kode hari ini masih single-user: nggak ada multi-tenant, nggak ada signup flow.

> 🚧 **MIGRASI MULTI-USER (rencana, belum diimplementasi):** sebelum menyentuh auth, schema Prisma, parser email, Telegram, cron, ingest, DNS, atau wizard,
> **baca [`docs/multi-user/README.md`](docs/multi-user/README.md)** (protokol sesi wajib: baca CAUTION → docs → Progress Log → fase aktif; update docs & log di akhir sesi).
> Jangan merge/push ke `main` untuk pekerjaan ini tanpa persetujuan eksplisit Arzaka (push `main` = auto-deploy + auto-migrate prod).

> ⚠️ **Baca [`CAUTION.md`](CAUTION.md) sebelum `npm run build`/`start:dev` apapun.** VPS ini cuma 2GB
> RAM dan prod jalan di sini terus — pernah bikin prod down gara-gara build tanpa cap memory + dev
> Postgres nyala bareng. Selalu `NODE_OPTIONS=--max-old-space-size=1536`, jangan tumpuk proses berat.

Konteks tambahan (`Product.md`, `Decisions.md`, `Gotchas.md` hanya ada lokal — di-gitignore karena repo public, jangan di-commit): `docs/context/Product.md` (kenapa & alur uang nyata) dan `docs/context/Codemap.md` (peta module/route/cron + drift yang diketahui).

## Tech Stack

- Backend: NestJS + Prisma + PostgreSQL, di `apps/backend`
- Frontend: Next.js 14 App Router + Tailwind CSS + SWR, di `apps/frontend`
- Auth: JWT via httpOnly cookie (bukan localStorage)
- Deploy: Docker Compose di VPS Tencent Cloud (Jakarta), Nginx + Let's Encrypt, GitHub Actions CD auto-deploy tiap push ke `main`
- Domain: `trackster.dev` (frontend), `api.trackster.dev` (backend) — dua subdomain terpisah, bukan satu domain. (Domain lama `track.trackster.my.id` hanya redirect di Nginx.)

## Struktur & Konvensi

- Tiap fitur backend = 1 module NestJS (folder di `apps/backend/src/modules/`, isi: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/` kalau perlu validasi). Ikuti pola yang sudah ada, jangan bikin struktur baru.
- Data fetching frontend SELALU lewat `useSWR` + `apps/frontend/src/lib/api.ts` — jangan fetch langsung, jangan pakai data statis/mock.
- Auth flow (middleware.ts, cookie httpOnly) sudah settled — jangan diubah tanpa alasan kuat.
- Sebelum lapor task selesai: WAJIB jalanin `npm run build` (backend) dan `tsc --noEmit` (frontend), lalu **verifikasi hidup di browser** — bukan cuma lolos compile. Riwayat project ini penuh kasus "lolos compile tapi rusak pas jalan beneran".
- Commit dengan pesan jelas per unit kerja logis (jangan 1 commit raksasa gabungan banyak hal tanpa keterangan).

## Domain Logic — Parser Email Bank

- Email BCA & Jago itu **HTML**, bukan plain text, dan strukturnya **3 kolom tabel** (label / separator ":" / value) — BUKAN format "Label: Value" satu baris. `extractField()` di `parser.interface.ts` sudah handle dua pola sekaligus (colon-inline dan label-lalu-baris-berikutnya, skip baris separator murni).
- **Exclusion rules** (transaksi yang TIDAK dihitung sebagai expense):
  - BCA transfer ke FLIPTECH = SoF funding ke Flip (bukan expense akhir; tujuan final dari email Flip). Transfer BCA ke rekening di `OWNER_ACCOUNT_NUMBERS` juga exclude.
  - Email Flip: exclude **hanya** kalau beneficiary account/nama = rekening sendiri (`OWNER_ACCOUNT_NUMBERS` / `OWNER_FULL_NAME`). Transfer Flip ke merchant, orang lain, atau VA e-commerce **dicatat** sebagai expense (source mengikuti SoF, biasanya BCA).
  - Email Flip subject "Transaction information to multiple destinations" = instruksi bayar ke rekening Flip (belum expense final, uangnya baru keluar saat SoF BCA kepotong) — **diabaikan** (`parse()` return `null`), bukan dicatat sebagai transaksi terpisah dari receipt-nya.
  - Jago transfer ke rekening/nama sendiri = internal
  - Email GoPay sengaja TIDAK diproses (out of scope). Top-up GoPay via **VA BCA** tetap tercatat dari email BCA.
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
- **Aturan baseline vs backfill:** transaksi/income yang `occurredAt`-nya lebih lama dari koreksi manual (`BalanceAdjustment`) terakhir untuk source yang sama TIDAK menggerakkan saldo — koreksi manual = snapshot saldo asli bank yang sudah mencakup transaksi itu. Dicek via `BalanceService.getLastManualAdjustmentAt()` + `shouldAdjustBalance()`, dipakai di `TransactionService.createFromParsed()`. Berlaku juga nanti buat income otomatis (E02).
- `BalanceAdjustment` log HANYA untuk koreksi manual, bukan buat tiap transaksi otomatis (itu sudah keliatan di halaman transaksi biasa).
- **Prinsip (E02-S1):** uang yang *benar-benar* keluar/masuk rekening selalu menggerakkan saldo; klasifikasi
  (expense / pemasukan / internal) itu urusan terpisah. Siapa gerakin apa:

  | Event email | Klasifikasi | Saldo |
  |---|---|---|
  | BCA → FLIPTECH (SoF) | exclude | **tidak** bergerak (receipt Flip yang pegang) |
  | Flip receipt → orang lain | expense | source SoF − |
  | Flip receipt → rekening sendiri | exclude, `balanceOnly` | source SoF − |
  | BCA/Jago transfer langsung → rekening sendiri | exclude, `balanceOnly` | source − |
  | Jago "menerima uang" | Income (CONFIRMED/INTERNAL/PENDING) | JAGO + (selalu, apapun status-nya) |

  `ParseResult.balanceOnly=true` (di `bca.parser.ts`/`flip.parser.ts`/`jago.parser.ts`) → `GmailSyncService`
  tetap mendebit saldo tanpa bikin `Transaction`, dedup lewat `EmailParseLog.status=EXCLUDED` (skip kalau
  sudah pernah diterapkan, cron scan berulang tidak boleh dobel-debit). Aturan baseline di atas tetap berlaku.

## Gotcha Infrastruktur (jangan diulang!)

- **Prisma + Alpine**: image `node:20-alpine` butuh `RUN apk add --no-cache openssl` eksplisit di builder DAN runner stage, kalau nggak Prisma engine crash-loop dengan error samar ("Could not parse schema engine response").
- **NODE_ENV urutan penting**: `ENV NODE_ENV=production` di Dockerfile HARUS di-set SETELAH `npm install`, bukan sebelum — npm otomatis skip devDependencies kalau NODE_ENV=production sudah aktif saat install, meskipun tidak ada flag `--omit=dev` eksplisit.
- **VPS cuma 2GB RAM**: image **tidak lagi di-build di VPS** (sejak 2026-10-04, build di GitHub Actions → GHCR). Build manual di VPS (`docker compose build`) hanya fallback darurat: sequential, `NODE_HEAP_MB` default 1280 (build-arg di Dockerfile; CI pakai 4096 — `nest build` butuh >1280MB heap). Berlaku juga buat `npm run build`/`npm run start:dev` lokal di sesi Claude Code — **pernah bikin prod down** (2026-09-28) gara-gara build tanpa cap + dev Postgres nyala bareng container prod. Detail & checklist: [`CAUTION.md`](CAUTION.md).
- **tsconfig rootDir**: `apps/backend/tsconfig.json` harus punya `"rootDir": "./src"` dan `"include": ["src/**/*.ts"]` — kalau nggak, TypeScript ikut compile `prisma/seed.ts` dan bikin output `dist/src/main.js` bukan `dist/main.js`, sementara CMD di Dockerfile expect `node dist/main`.
- **Prisma seed jangan pakai ts-node di production** — pakai plain JS (`prisma/seed.js` + `"prisma": {"seed": "node prisma/seed.js"}` di package.json). ts-node sering konflik ESM/CJS di Node 20+ dan gampang exclude dari devDependencies pas `npm install --omit=dev`.
- **Cookie cross-subdomain**: karena frontend (`trackster.dev`) dan backend (`api.trackster.dev`) beda subdomain, cookie JWT butuh `domain: process.env.COOKIE_DOMAIN` (`.trackster.dev`) eksplisit di `res.cookie()`, kalau nggak browser nggak nge-share cookie antar subdomain (gejala: login sukses 201 tapi langsung ke-redirect balik ke /login).
- **`useSearchParams()` di Next.js App Router** harus dibungkus `<Suspense>` kalau mau lolos `next build` (production), meskipun jalan normal di `next dev`.
- **Dockerfile naming**: file HARUS persis bernama `Dockerfile`, bukan `backend.Dockerfile` dst — kalau salah nama pas manual save dari luar, `docker compose build` gagal cari file.
- **`package-lock.json` nyimpen flag `dev` per-package terpisah dari `package.json`** — mindahin package dari devDependencies ke dependencies di `package.json` doang nggak cukup, `npm install --omit=dev` masih baca dari lockfile lama kalau nggak di-regenerate.
- **`tsconfig.tsbuildinfo` jangan sampai ke-commit** — sempat jadi biang keladi dev-server rusak berkali-kali karena cache stale ikut ke-track git. Sudah di-gitignore.

## Deployment

- CD (`.github/workflows/deploy.yml`) auto-jalan tiap push ke `main`, 2 job: (1) `build` — build image backend & frontend di runner GitHub, push ke `ghcr.io/arzakaraffan/trackster-{backend,frontend}` (tag `latest` + SHA commit); `NEXT_PUBLIC_*` di-bake sebagai build-arg (repo variable `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_SITE_URL`, fallback ke nilai prod di workflow). (2) `deploy` — SSH ke VPS, `git reset --hard origin/main` (checkout cuma buat `docker-compose.prod.yml` + `nginx/`), `docker compose pull backend frontend`, `up -d`. VPS tidak build apapun.
- VPS harus sudah `docker login ghcr.io` (PAT classic scope `read:packages`, **bukan** password akun) — tanpa itu `pull` gagal, `set -e` menghentikan deploy sebelum `up -d`, container lama tetap jalan. Rollback: `IMAGE_TAG=<sha-commit> docker compose -f docker-compose.prod.yml up -d`.
- `.env` di VPS **TIDAK** di-manage lewat git/CD (sengaja, demi keamanan) — kalau nambah env var baru, harus edit manual via SSH dan restart container manual (`docker compose up -d`, bukan `--build` kalau cuma env yang berubah).
- Migration Prisma jalan otomatis tiap backend container start (`npx prisma migrate deploy` di CMD Dockerfile) — tapi **seed TIDAK otomatis**, harus manual sekali: `docker compose -f docker-compose.prod.yml exec backend npx prisma db seed`.
- SSL certificate lewat `init-letsencrypt.sh` (dummy cert dulu biar nginx bisa start, baru tukar ke certificate asli) — cuma perlu dijalanin sekali di awal atau kalau ganti domain.

## Design System

- UI saat ini = **Trackster v3**, sumber kebenaran: `docs/Rework Design Trackster/` (`Trackster v3 App.dc.html` + README). Markup layar digenerate
  (`apps/frontend/scripts/dc-to-tsx.mjs` → `src/components/v3/views`), logika prototipe ada di `src/components/v3/logic.tsx`, data nyata di
  `src/components/v3/live/`. Detail: `docs/context/Codemap.md` (bagian Frontend) dan `docs/Rework Design Trackster/PLAN.md`.
- Token (warna/jarak/tipografi) hidup di `logic.tsx` (`DARK`, `LIGHT`, `DENSITY`) dan CSS variable di wrapper root — jangan pakai magic number Tailwind di layar v3.
- Layar v3 tidak memakai Tailwind preflight (`app/(v3)/layout.tsx` tidak mengimpor `globals.css`). Tools publik lama ada di `app/(legacy)`.
- Layar pra-app (Daftar, Masuk Google, Lupa password, Wizard setup, Harga/Plus) = **tampilan saja** (produk tetap single-user, tanpa backend baru).
- Mengubah layar: ubah desain → regenerate view; perubahan data/aksi → `useLive.ts` + cabang `live` di `logic.tsx`. Verifikasi dengan membandingkan ke prototipe standalone.
- Folder lama `design_system/` (Claude Design v2) tinggal arsip.


