# trackster — Gotchas

- **`TransactionService.remove()` tidak punya guard baseline saldo** (beda dari `createFromParsed()` yang sudah dibenerin di E01-S3) — hapus transaksi APAPUN selalu `adjustBalance(+amount)` tanpa cek apakah `occurredAt` lebih tua dari koreksi manual terakhir. Kejadian nyata 2026-09-24: user coba tombol Hapus baru (fitur yang baru di-ship) di 2 transaksi VA Tokopedia lama (occurredAt 4 Sep, sebelum baseline 22 Sep) lewat UI — saldo BCA lompat +Rp3.072.020 jadi salah, padahal transaksinya beneran ke-hapus (bukan cuma coba-coba). Root cause: baseline rule cuma diterapkan di jalur create, bukan delete, padahal keduanya sama-sama butuh (lihat `docs/revamp/02-conventions.md` §4). Fix: `remove()` harus pakai `shouldAdjustBalance()` yang sama (skip restore kalau `occurredAt < lastManualAdjustmentAt`), sama seperti raw-SQL dedupe script E01-S3. (`apps/backend/src/modules/transaction/transaction.service.ts`)

- **`tsconfig.tsbuildinfo` stale bikin `nest build` (backend) silent no-op**: exit code 0, tanpa error,
  tapi folder `dist/` nggak keisi sama sekali (bukan cuma stale — kosong total). Kejadian pas `.tsbuildinfo`
  ketinggalan dari run sebelumnya (beda absolute path/environment) lalu `tsc --incremental` mikir semua
  file "sudah up to date" dan skip emit, sementara `deleteOutDir: true` di `nest-cli.json` sudah kadung
  menghapus `dist/` lama. Fix: `rm apps/backend/tsconfig.tsbuildinfo` lalu build ulang. Sudah gitignored
  (lihat catatan lain di bawah), tapi kalau ada sisa file lokal dari sesi sebelumnya tetap bisa kena.
  (`apps/backend/nest-cli.json`, `apps/backend/tsconfig.json`)

- **`npx prisma migrate dev` selalu gagal di shell non-interactive** (termasuk sesi Claude Code ini) dengan
  "Prisma Migrate has detected that the environment is non-interactive" — `--create-only` pun tetap gagal.
  Workaround: generate SQL manual dengan `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma
  --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_<nama>/migration.sql`
  (folder dibuat manual dulu), lalu `npx prisma migrate deploy` buat apply ke DB dev. Baca dulu SQL yang
  dihasilkan sebelum apply. (`apps/backend/prisma/`)

> Jebakan & hal non-obvious. Tiap bug yang makan > 15 menit -> tulis di sini. Terbaru di atas.
> Lihat juga bagian "Gotcha Infrastruktur" di `CLAUDE.md` (Prisma+Alpine openssl, urutan `NODE_ENV`,
> OOM build 2GB RAM, `rootDir` tsconfig, seed plain JS, `useSearchParams` + Suspense, dll).

---

- **VPS ini = production, dan `docker-compose.yml` (dev) berbagi project name + volume dengan prod** (`trackster_trackster_pg_data`). `docker compose up -d postgres` tanpa `-f docker-compose.prod.yml` bisa me-recreate Postgres prod dengan config dev (lepas dari `shared-web-net`). DB dev: `docker compose -p trackster-dev up -d postgres` (port 5434). Detail: `docs/revamp/02-conventions.md` §1. (`docker-compose.yml`)

- **Container backend jalan di UTC (`TZ` kosong)**, host VPS `Asia/Shanghai`. Semua `setHours(0,0,0,0)` / `getDay()` / `toISOString().slice(0,10)` = batas hari UTC → transaksi 00:00–06:59 WIB masuk hari kemarin. Fix direncanakan di `docs/revamp/epics/E00-foundation.md` (helper `wib.ts`). (`apps/backend/src/modules/transaction/transaction.service.ts`)

- **Email BCA "Transfer to BCA Virtual Account" (GoPay top-up dll) tidak ter-parse** — labelnya `Pay Amount`/`Total Payment`/`Company/Product Name`, bukan `Transfer Amount`/`Beneficiary Name`. Email Flip "Transaction information…" adalah instruksi bayar (bukan transfer) tapi ikut tercatat → dobel. Detail & bukti: `docs/revamp/01-findings.md` A1–A2. (`apps/backend/src/modules/gmail/parsers/`)

- **Folder design system namanya `design_system/`** (underscore), bukan `design-system/` seperti tertulis di CLAUDE.md.

- **Domain sekarang `track.trackster.my.id` / `api.track.trackster.my.id`** — dua subdomain terpisah (frontend & backend). `.env.example` & `README.md` masih nyebut `trackster.my.id` lama; sumber kebenaran adalah `nginx/conf.d/trackster.conf`. (`nginx/conf.d/trackster.conf`)

- **Cookie JWT butuh `domain: COOKIE_DOMAIN` eksplisit** — karena frontend & backend beda subdomain. Tanpa itu: login 201 sukses tapi langsung ke-redirect balik `/login`. `secure` hanya aktif kalau `NODE_ENV=production`. Nama cookie hardcoded `trackster_jwt` di `auth.controller.ts` DAN `jwt-auth.guard.ts` DAN `middleware.ts` — ubah harus di tiga tempat. (`apps/backend/src/modules/auth/auth.controller.ts`)

- **Semua perubahan saldo WAJIB lewat `balanceService.adjustBalance(tx, ...)` di dalam `prisma.$transaction`** yang sama dengan operasi utamanya — hindari race condition saldo tak sinkron. Berlaku di `transaction.service` (create/createFromParsed/remove) & `income.service` (create/update/delete pakai delta selisih). (`apps/backend/src/modules/transaction/transaction.service.ts`)

- **`emailId` adalah unique non-null** — transaksi manual di-generate sintetis `manual:<uuid>` (bukan buat dedup, cuma buat isi kolom). Dedup asli cuma buat transaksi sync (Gmail message ID). (`prisma/schema.prisma`)

- **Email BCA/Jago itu HTML 3-kolom tabel**, bukan "Label: Value" satu baris. `htmlToText()` di `gmail-sync.service.ts` ganti tag block-level jadi `\n` DULU sebelum strip tag, biar `extractField()` (berbasis `split('\n')`) tetap jalan. (`apps/backend/src/modules/gmail/gmail-sync.service.ts`)

- **Query Gmail masih pakai keyword kasar** `from:(bca OR jago) newer_than:7d` + `maxResults: 20` — ada TODO buat pakai domain sender asli. Kalau sync miss transaksi lama > 7 hari atau > 20 email/5menit, ini penyebabnya. (`apps/backend/src/modules/gmail/gmail-sync.service.ts`)

- **Exclusion rules parser** (transaksi TIDAK dihitung expense): BCA transfer ke beneficiary mengandung "FLIPTECH" (top-up BCA→Jago via Flip), Jago transfer ke nama match `OWNER_FULL_NAME` (transfer ke rekening sendiri). Diproses sebagai `parsed.excluded` di parser, di-skip di `syncEmails`. (`apps/backend/src/modules/gmail/parsers/`)

- **Alert Telegram over-budget maks 1x/hari** — dijaga `AlertLog` dengan `@@unique([date])`, dicek pakai `new Date(summary.date)` (date-only). Cuma dicek setelah ada transaksi baru dari sync, bukan cron terpisah. (`apps/backend/src/modules/gmail/gmail-sync.service.ts`)

- **Split Bill `publicSlug` vs `ownerToken` jangan disatukan** — `publicSlug` cuma buat teman lihat & tandai lunas; `ownerToken` buat pembuat anonim reassign item tanpa login. Kalau digabung, teman bisa ikut ngedit assignment. `POST /split-bills/public` pakai `ThrottlerGuard`. (`apps/backend/src/modules/split-bill/split-bill.controller.ts`)

- **`middleware.ts` matcher exclude semua path ber-ekstensi** (`.*\\..*`) selain `_next/*` — kalau nggak, request asset publik (logo, favicon) ikut ke-redirect `/login` buat visitor belum login. Path publik: exact `/`, `/login`, `/savings-calculator`, `/split-bills/new`; prefix `/s/`, `/split-bills/manage/`. (`apps/frontend/src/middleware.ts`)

- **Cron sync `@Cron(EVERY_5_MINUTES, { name: 'gmail-sync' })`** — `name` wajib biar `SchedulerRegistry.getCronJob` bisa hitung `getNextRun()` buat countdown di frontend. (`apps/backend/src/modules/gmail/gmail-sync.service.ts`)

- **Dev DB di host port 5434** (`docker-compose.yml` map `5434:5432`), tapi `.env.example` `DATABASE_URL` nulis `5432` — sesuaikan kalau connect gagal. Prod pakai `docker-compose.prod.yml` (postgres di network `shared-web-net`, expose `5432`). (`docker-compose.yml`)

- **`npx nest build` bisa exit 0 TANPA nulis `dist/` sama sekali** kalau VPS lagi tekanan memori tinggi (swap penuh) — proses tsc child-nya ke-OOM-kill diam-diam, tapi wrapper nest-cli tetap report sukses. Kalau ketemu ini, jangan langsung nyalahin kode: cek `ls dist/main.js`, kalau nggak ada padahal exit 0, coba `npx tsc -p tsconfig.json` langsung (lebih jujur soal error & lebih hemat memori) buat verifikasi compile beneran bersih. Jangan jalanin `npm run build` bolak-balik di VPS ini bareng container prod yang lagi hidup — bebasin RAM dulu (stop container dev yang nggak perlu) sebelum build berat. (VPS 2GB RAM, lihat juga catatan RAM di `CLAUDE.md`)

- **Mengimpor `@prisma/client` me-load SEMUA key `apps/backend/.env` ke `process.env`, bukan cuma `DATABASE_URL`** — jadi self-check script (`npx ts-node ...check.ts`) ikut kepengaruh isi `.env` lokal meskipun script-nya nggak pernah `require('dotenv')` sendiri. Gejala: `parsers.check.ts` "Flip receipt internal: excluded = true" gagal di dev karena `.env` lokal punya placeholder `OWNER_ACCOUNT_NUMBERS=0000000000` yang nimpa default rekening asli di `own-accounts.ts` — BUKAN bug di parser/exclusion logic (dicek: fail juga di `main` sebelum ada perubahan apapun sesi ini). Kalau self-check yang nyentuh `OWNER_ACCOUNT_NUMBERS`/`OWNER_FULL_NAME` tiba-tiba gagal di dev, cek isi `.env` dulu sebelum curiga ke kode. (`apps/backend/src/modules/gmail/parsers/own-accounts.ts`)
