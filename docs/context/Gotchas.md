# trackster — Gotchas

- **Self-check frontend (`*.check.ts` di apps/frontend) tidak jalan dengan `npx ts-node`** — error
  `ERR_UNKNOWN_FILE_EXTENSION`. Jalanin pakai `npx tsx <file>` (tsx auto-install oleh npx).
  Backend self-check tetap pakai `npx ts-node`.
- **Backend `npm run build` bisa OOM di VPS 2GB** (`Ineffective mark-compacts near heap limit`) kalau
  ada proses lain jalan. Fix: `NODE_OPTIONS=--max-old-space-size=2048 npm run build`.
- **Push ke `main` lalu langsung jalanin dev-testing lokal di VPS ini (dev Postgres, `node dist/main.js`
  lokal, dll) bisa bikin CD (`deploy.yml`) gagal diam-diam** — kejadian nyata 2026-09-27 sesi E04-S4/S5:
  push commit lalu (di sesi yang sama, VPS yang sama) langsung `docker compose -p trackster-dev up -d
  postgres` + jalanin backend lokal buat verifikasi manual, sementara GitHub Actions SSH masuk dan mulai
  `docker compose -f docker-compose.prod.yml build backend` (sequential, RAM 2GB pas-pasan per Gotcha di
  bawah). Kontensi RAM bikin job CD gagal — Arzaka dapat email notifikasi "deploy failed" — TAPI docker
  layer cache dari attempt yang gagal itu ternyata sempat kebentuk lengkap sampai `trackster-backend:latest`
  (dicek: `docker run --rm trackster-backend:latest grep ...` sudah punya kode baru), cuma `docker compose
  up -d` yang nggak sempat/gagal jalan buat swap container yang lagi hidup. Gejala: container lama TETAP
  jalan kode lama tanpa error apapun di `docker logs` (tidak crash, cuma nggak keganti). Fix: matiin dulu
  semua proses dev lokal (`docker compose -p trackster-dev down -v`, `pkill -f "node dist/main.js"`), cek
  `free -h`, baru manual ulangi 3 langkah terakhir `deploy.yml` (`build backend`, `build frontend`, `up -d`)
  — kalau image sudah cached, ini cepat. **Pelajaran:** kalau abis push ke main, JANGAN langsung mulai
  sesi dev-testing lokal di VPS yang sama sebelum ngecek CD selesai (atau minimal kasih jeda) — dan kalau
  mau redeploy manual gara-gara ini, WAJIB `git stash` dulu perubahan lokal yang belum di-commit, karena
  `deploy.yml` beneran `git reset --hard origin/main` di checkout yang SAMA dengan yang dipakai sesi
  interaktif ini (`~/trackster`) — kalau nggak di-stash, kerjaan lokal yang belum di-commit bisa
  ke-hard-reset kalau CD (atau redeploy manual yang niru `git reset --hard`) kebetulan jalan lagi.

- **`AI_BASE_URL=http://host.docker.internal:20128` (nilai container prod) tidak resolve kalau backend
  dijalanin langsung di host** (`node dist/main.js`, bukan lewat Docker) — `host.docker.internal` cuma
  valid dari DALAM container (`extra_hosts` di `docker-compose.prod.yml`). Gejala: chat AI balas fallback
  generik "ada gangguan teknis", log sebenarnya `TypeError: fetch failed` di `AiService.chat()`. Fix buat
  verifikasi lokal di VPS ini (2026-09-27, sesi E04-S4): `export AI_BASE_URL=http://localhost:20128` sebelum
  start — 9router jalan sebagai proses host biasa (`ps aux | grep 9router`), bukan container, jadi
  `localhost` yang benar dari host. Ini gotcha BARU yang beda dari soal `NEXT_PUBLIC_API_URL`/`COOKIE_DOMAIN`
  di bawah (itu soal env var container yang salah ke-inherit; ini soal hostname yang cuma valid di dalam
  container satunya lagi). (`apps/backend/src/modules/ai/ai.service.ts`)

- **Sesi cloud Claude Code ini punya env var asli level-container** (`NEXT_PUBLIC_API_URL`, `AI_API_KEY`,
  `COOKIE_DOMAIN`, `GMAIL_CLIENT_*`, `TELEGRAM_BOT_TOKEN`, dll — bukan cuma placeholder) yang **menunjuk ke
  prod** (`https://api.track.trackster.my.id`), ditambahin user lewat environment settings (bukan lewat
  `.env` file). Bikin `apps/frontend/.env.local` buat override **TIDAK CUKUP** — Next.js (`@next/env`)
  nggak nimpa env var yang udah ke-`export` di `process.env`, jadi `next dev` tetap pakai
  `NEXT_PUBLIC_API_URL` prod walau `.env.local` bilang `localhost:4000`. Harus di-override eksplisit pas
  start: `NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev`. Sama juga buat backend: `COOKIE_DOMAIN`
  container = `.track.trackster.my.id`, bikin cookie nggak ke-set di `localhost` (browser tolak Domain
  attribute yang nggak match host) — `unset COOKIE_DOMAIN` sebelum `node dist/main.js` buat dev lokal.
  **Risiko nyata:** request (login, dll) dari test lokal yang lupa di-override bisa kekirim ke API PROD
  beneran, bukan cuma dev — sempat kejadian 2026-09-27 (1 login gagal doang, tapi bisa lebih parah kalau
  request-nya nulis data). Selalu cek `env | grep NEXT_PUBLIC` sebelum jalanin browser test di sesi ini.

- **`docker compose up -d` restart nginx tiap kali backend/frontend trackster di-recreate (dependency), dan nginx nggak resolve upstream sibling site yang lagi mati → nginx ikut crash-loop, SEMUA situs di belakangnya (trackster, charon, isistasiun, dll) ikut down.** Kejadian 2026-09-26: deploy `E02-S1` sempat gagal di GH Actions (lihat gotcha "npx nest build bisa exit 0..."), di-retry manual, tapi `nginx/conf.d/ai-trackster.conf` masih pakai `proxy_pass http://ai-frontend:3100` polos (DNS upstream di-resolve SEKALI saat nginx start) — begitu container `ai-frontend` nggak ada/mati, nginx gagal start total ("host not found in upstream"), bukan cuma 502 di site itu doang. Fix: `resolver 127.0.0.11 valid=10s;` (DNS resolver Docker) + `set $up http://<host>:<port>; proxy_pass $up;` — bikin resolusi DNS lazy per-request, nginx tetap start meski upstream lagi mati (baru 502 pas ada request ke situ). Pola ini SUDAH dipakai di `isistasiun-fe-prod.conf`, belum konsisten di semua vhost lain — cek tiap nambah/ubah vhost baru. (`nginx/conf.d/ai-trackster.conf`)

- **"Rapikan Kategori" (E00-S3) tidak pernah benar-benar nyimpen — semua transaksi lama tetap `LAINNYA`**
  (dilaporkan Arzaka 2026-09-25, root cause di `TransactionService.updateCategoryForAll()` &
  `countSameMerchant()` di `apps/backend/src/modules/transaction/transaction.service.ts`). Kolom
  `merchantKey` ditambah via migrasi `20260924144111_expand_category_and_merchant_key` **tanpa backfill**
  (`ALTER TABLE ... ADD COLUMN "merchantKey" TEXT;` doang) — backfill-nya cuma skrip manual
  `prisma/data-fixes/2026-09-backfill-merchant-key.ts` yang butuh `ts-node`, dan **ts-node nggak ada di
  container prod** (`--omit=dev`, lihat Gotcha Infrastruktur di CLAUDE.md) jadi hampir pasti nggak pernah
  jalan di prod. Akibatnya semua transaksi lama `merchantKey = NULL`, sementara `updateCategoryForAll`
  query `where: { merchantKey: key }` — nggak pernah match apa-apa (termasuk transaksi representative-nya
  sendiri), return `{ updated: 0 }` yang diam-diam dianggap sukses sama frontend (`onApplied()` langsung
  hapus baris dari list tanpa cek response). Fix: recompute `merchantKey(description)` di JS buat baris
  yang NULL (helper `merchantMatchWhere()`), sekalian backfill kolomnya pas update — bukan cuma percaya
  kolom yang mungkin kosong. **Pelajaran:** kolom baru yang dipakai buat matching/join query WAJIB
  di-backfill di migration yang sama (SQL `UPDATE` langsung, bukan skrip terpisah yang gampang
  kelewatan/nggak jalan di prod), atau kode yang query kolom itu harus defensif terhadap NULL.

- **VPS 2GB RAM ini bisa kehabisan memori total (RAM+swap) kalau ada beberapa sesi Claude Code jalan
  bareng** — `npx tsc --noEmit` (backend, project NestJS+Prisma) butuh sekitar 1.2-1.5GB heap buat compile
  bersih; `nest start --watch` yang gagal boot bisa nyangkut jadi proses orphan makan 800MB+ RSS
  (`node .../nest start --watch` tanpa child `dist/main` yang jalan — cek `ps aux --sort=-%mem`, bukan
  cuma `docker stats`, prosesnya bukan di container). Gejala: `tsc`/`nest build` exit dengan
  "FATAL ERROR: ... JavaScript heap out of memory" (beda dari gejala silent-no-op di gotcha lain di bawah
  yang exit 0 tanpa error) ATAU exit 0 tapi `dist/main` nggak ada. Mitigasi yang kepake: set
  `NODE_OPTIONS="--max-old-space-size=1536"` (angka yang sama dipakai di Dockerfile build stage) untuk
  `tsc --noEmit` langsung di host (bukan cuma di build Docker), cek `free -h` sebelum & sesudah proses
  berat, dan **selalu** `kill -9` proses `nest start --watch`/`node dist/main` dev begitu selesai verifikasi
  — jangan biarkan nyangkut, karena itu bisa bikin proses lain (termasuk container prod) ke-OOM-kill kernel.
  Kalau `tsc --noEmit` OOM padahal `free -h` nunjukin ada RAM "available", coba lagi—kontensi dari sesi lain
  berfluktuasi tiap beberapa detik di VPS ini.

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

- **Dictionary `indonesian` bawaan Postgres nge-stem "menabung" jadi `abung`, bukan `nabung`** — beda root dari "nabung"/"tabungan"/"ditabung" yang semuanya konsisten ke `tabung`. Jangan asumsikan semua kata berimbuhan "me-"/"di-" dari root yang sama otomatis match di FTS (`websearch_to_tsquery('indonesian', ...)`) — cek dulu pasangan katanya beneran ke-stem sama pakai `SELECT to_tsvector('indonesian', '...')` manual. (`apps/backend/src/modules/ai/retrieval.check.ts`)

- **`prisma migrate dev` salah baca generated column (`GENERATED ALWAYS AS (...) STORED`, dipakai buat `ChatMessage.search` tsvector E04-S3) sebagai kolom ber-`DEFAULT`** — jalanin ulang `migrate dev` setelah migration manual seperti itu bikin Prisma bikin migration drift PALSU (`DROP INDEX` GIN yang baru dibuat + `ALTER COLUMN ... DROP DEFAULT`). **Jangan pernah apply drift migration itu.** Kalau perlu cek drift setelah migration manual, pakai `migrate dev --create-only` dulu, baca isi SQL-nya, kalau isinya soal generated column ini → hapus folder migrationnya, jangan di-apply. (`apps/backend/prisma/migrations/20260927103024_add_chat_search_fts/migration.sql`)
