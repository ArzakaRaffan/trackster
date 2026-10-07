# 06 — Runbook Operasional

> **Baca [`/CAUTION.md`](../../CAUTION.md) dulu.** VPS 2GB; prod selalu jalan. Satu proses berat sekaligus. Jangan menjalankan perintah di bawah tanpa
> memahami targetnya (prod vs dev). Perintah yang memodifikasi data/DNS memerlukan persetujuan Arzaka (README §6).
> Nama container/direktori di bawah berasal dari CAUTION.md & compose (`trackster-postgres-1`, user DB `trackster`, DB `trackster`); **verifikasi dengan `docker ps` sebelum menjalankan**.

## 1. Backup DB prod 🛟

```bash
# di VPS (SSH). Simpan di luar repo; JANGAN commit dump (berisi data finansial pribadi)
docker exec trackster-postgres-1 pg_dump -U trackster trackster > ~/backup-$(date +%F-%H%M).sql
ls -lh ~/backup-*.sql | tail -1
sha256sum ~/backup-*.sql | tail -1     # catat nama+checksum di Progress Log (bukan isinya)
```
- Backup wajib sebelum: setiap deploy yang membawa migrasi, backfill (F1), C1 (F4), cutover (F7), hapus akun (F9).
- Simpan ≥ 3 backup terakhir; salin 1 salinan ke luar VPS (mis. `scp` ke laptop). Enkripsi bila disimpan di cloud.
- (F9) Jadwalkan backup harian otomatis (cron VPS) + retensi 7 hari.

## 2. Restore-drill ke DB dev (membuktikan backup berguna & tempat uji migrasi)

Aturan CAUTION: dev Postgres adalah proses berat — **jalankan sendirian**, matikan setelah selesai.

```bash
# di mesin dev (atau VPS bila RAM lega — pastikan free -h)
docker compose -p trackster-dev up -d postgres           # dev DB di host port 5434 (docker-compose.yml)
# buat DB bersih lalu restore
docker exec -i trackster-dev-postgres-1 psql -U trackster -c 'DROP DATABASE IF EXISTS trackster_restore;'
docker exec -i trackster-dev-postgres-1 psql -U trackster -c 'CREATE DATABASE trackster_restore;'
docker exec -i trackster-dev-postgres-1 psql -U trackster trackster_restore < ~/backup-YYYY-MM-DD-HHMM.sql
# bandingkan jumlah baris tabel kunci dengan prod
docker exec -i trackster-dev-postgres-1 psql -U trackster trackster_restore -c 'SELECT count(*) FROM "Transaction";'
# SETELAH SELESAI:
docker compose -p trackster-dev down
```
- Arahkan `DATABASE_URL` dev ke `…:5434/trackster_restore` untuk uji migrasi/backfill/golden snapshot.
- Catat hasil restore-drill (tanggal, jumlah baris sama/tidak) di Progress Log.

## 3. Migrasi skema bertahap (F1 expand/backfill, F4 contract)

1. Backup (§1) + restore ke DB uji (§2).
2. Di DB uji: `npx prisma migrate dev --create-only --name <nama>` → **tinjau & edit SQL** → `npx prisma migrate dev` (cap RAM: `NODE_OPTIONS=--max-old-space-size=1536`).
3. Jalankan `verify-backfill.ts` (hitung `userId NULL`, total) → hasil dicatat.
4. Jalankan golden snapshot "sesudah" → diff kosong (F1) / sesuai harapan.
5. Hanya setelah semuanya hijau dan Arzaka setuju: merge ke `main` → CI deploy → **migrasi jalan otomatis saat backend start** (log: `docker compose -f docker-compose.prod.yml logs backend`).
6. Backfill data (skrip `prisma/data-fixes/…`) dijalankan **manual** di prod setelah deploy kode expand:
   ```bash
   docker compose -f docker-compose.prod.yml exec backend node prisma/data-fixes/<skrip>.js   # skrip JS biasa (bukan ts-node di prod)
   ```
   Skrip harus **idempoten** & mencetak ringkasan sebelum/sesudah.
7. `verify-backfill` di prod → `NULL = 0`.
- **Dilarang:** `prisma migrate reset`, `db push`, `DROP` tabel/kolom berisi data tanpa backup + persetujuan.
- Jika migrasi gagal saat deploy: container backend crash-loop (`migrate deploy && node dist/main`) → container lama sudah diganti. **Rollback:** `IMAGE_TAG=<sha-sebelumnya> docker compose -f docker-compose.prod.yml up -d` (gambar lama; skema kolom-nullable aman untuk kode lama). Untuk C1 yang gagal setengah jalan → restore backup.

## 4. Pindah DNS `trackster.dev` ke Cloudflare (F7) — ⛔ persetujuan tiap langkah

Prasyarat: O1 terjawab. Lakukan di jam sepi. Siapkan **catatan NS lama** (`ns1bcp.name.com` dst.) untuk rollback.

1. **Inventaris record** di panel name.com (screenshot/ekspor): A `@`, A `api`, `www`, MX, TXT (SPF/verifikasi), CAA, CNAME. Catat TTL. Cek **DNSSEC** (jika aktif → matikan di name.com *sebelum* ganti NS, kalau tidak domain bisa gagal resolve).
2. **Turunkan TTL** record penting menjadi 300 detik beberapa jam sebelumnya.
3. Buat akun/zona Cloudflare (plan Free), tambahkan `trackster.dev`; Cloudflare memindai record — **bandingkan satu per satu** dengan inventaris; tambahkan yang hilang.
4. Semua record yang menunjuk VPS (`@`, `api`, `www`) = **DNS only (awan abu-abu)**. Jangan aktifkan proxy oranye: certbot HTTP-01 & konfigurasi Nginx saat ini berasumsi koneksi langsung ke VPS. (Proxy bisa dievaluasi nanti, terpisah.)
5. Di name.com, ganti nameserver ke dua NS yang diberikan Cloudflare.
6. Tunggu propagasi; verifikasi:
   ```bash
   dig NS trackster.dev +short            # harus NS Cloudflare
   dig A trackster.dev +short ; dig A api.trackster.dev +short   # IP VPS sama seperti sebelumnya
   curl -I https://trackster.dev ; curl -I https://api.trackster.dev/auth/me
   ```
7. Verifikasi pembaruan sertifikat (di VPS, hormati CAUTION). Mekanisme renew proyek: service `certbot` di `docker-compose.prod.yml` menjalankan `certbot renew` tiap 12 jam (webroot `/var/www/certbot`, HTTP-01 lewat Nginx port 80). Uji tanpa efek:
   ```bash
   docker compose -f docker-compose.prod.yml run --rm --entrypoint "certbot renew --dry-run" certbot   # verifikasi sintaks perintah sebelum menjalankan
   ```
   HTTP-01 hanya berhasil bila domain menunjuk langsung ke VPS (karena itu record **DNS only**, bukan proxy oranye).
8. Pantau 24–48 jam (situs, API, Telegram webhook, CD).
9. **Rollback:** kembalikan NS lama di name.com (propagasi sesuai TTL).

## 5. Email Routing + Worker (F7)

1. Di zona Cloudflare: Email → Email Routing → aktifkan untuk subdomain `in.trackster.dev` (menambah MX/TXT Cloudflare). Baca dokumentasi terbaru dulu (dukungan subdomain, batas) — catat versi/tanggal di Progress Log.
2. Buat Worker `trackster-inbound` (kode di `infra/cloudflare-worker/` repo, tanpa rahasia); `wrangler secret put INGEST_HMAC_SECRET` (nilai sama dengan env backend); var `INGEST_URL=https://api.trackster.dev/ingest/email`, `DEAD_LETTER=<alamat admin terverifikasi>`.
3. Routing: catch-all `*@in.trackster.dev` → Worker.
4. Tes: kirim email ke `u-<localPart>@in.trackster.dev` dari Gmail Arzaka → cek log backend + `EmailParseLog`.
5. Monitoring: bila Worker gagal POST → `message.forward(DEAD_LETTER)`; cek dashboard Workers → Logs.

## 6. Shadow mode & cutover owner (F7)

1. Pasang filter Gmail Arzaka: `from:(<domain-domain bank>)` → forward ke alamat inbound (setelah verifikasi kode di wizard). Gmail OAuth lama **tetap aktif**.
2. `InboundAddress.shadow=true` (via CLI/skrip admin). Tunggu ≥ 7 hari mencakup: transaksi biasa, transfer Flip, BCA→Flip, Jago terima uang, transfer ke rekening sendiri, email "multiple destinations", email non-transaksi (OTP/promosi).
3. `compare-shadow.ts` harian → laporan selisih. Syarat cutover: **0 selisih tak terjelaskan** selama 7 hari berturut-turut dan semua jenis email di atas muncul minimal sekali.
4. ⛔ **Cutover** (satu jendela, dicatat jamnya): `shadow=false` → hentikan cron `gmail-sync` → cabut token Gmail (`/gmail/disconnect` atau cabut di myaccount.google.com/permissions) → verifikasi tak ada transaksi ganda selama 24 jam (cek `EmailParseLog` & transaksi baru).
5. Setelah 3–7 hari stabil: hapus kode Gmail (P7-09).
6. **Rollback cutover:** sambungkan ulang Gmail, aktifkan cron lagi, `shadow=true` — dedup per `emailId` berbeda (Gmail ID vs `fwd:`) sehingga **bisa terjadi dobel catat** untuk email yang diproses oleh dua jalur; karena itu cutover dilakukan pada titik waktu yang jelas dan email di sekitarnya diperiksa manual setelah rollback.

## 7. Onboarding user baru (operasional, setelah F5)

```bash
docker compose -f docker-compose.prod.yml exec backend node prisma/user-admin.js invite --for "<nama>"   # cetak URL undangan (7 hari)
# kirim URL ke tester lewat kanal pribadi (jangan publik). Setelah mereka daftar:
docker compose -f docker-compose.prod.yml exec backend node prisma/user-admin.js list
# reset password (admin-issued)
docker compose -f docker-compose.prod.yml exec backend node prisma/user-admin.js reset --username <u>   # cetak URL reset sekali pakai
# nonaktifkan
docker compose -f docker-compose.prod.yml exec backend node prisma/user-admin.js disable --username <u>
```
(Satu skrip: `prisma/user-admin.js` — juga `enable --username <u>`. Env VPS opsional: `MAX_USERS` (default 10), `FRONTEND_URL` dipakai untuk membentuk URL.)

### 7b. Shortcut iPhone / input manual (setelah F6)

User membuat token di **Setting → Shortcut** (maks 5 aktif; plaintext `trk_…` hanya tampil sekali, DB menyimpan hash SHA-256). Endpoint (Bearer, bukan cookie):

| Pintu | Body JSON | Header wajib |
| --- | --- | --- |
| `POST /ingest/transaction` | `amount` (angka/teks angka), `description` (≤200), `source` (`BCA\|JAGO\|BNI\|MANDIRI\|RAYA\|BRI`) · opsional `category`, `occurredAt` | `Authorization: Bearer trk_…`, `Idempotency-Key` (8–100 karakter `A-Za-z0-9._:-`) |
| `POST /ingest/income` | `amount`, `description`, `source` · opsional `receivedAt`, `streamId`, `streamName` | sama |

Balasan: `201 {success, duplicate:false, id, message}`; kunci yang sama → `200 {duplicate:true}` (tidak mencatat/menggerakkan saldo lagi). `400` validasi, `401` token salah/dicabut/user nonaktif, `429` >60 req/menit/token.
Shortcut iOS: aksi **Get Contents of URL** (POST, JSON) + dua header di atas; kunci unik = *Format Date* `yyyyMMddHHmmssSSS` + *Random Number*. Android (O7 belum dijawab): HTTP Shortcuts / Tasker dengan request yang sama.
`source` sengaja wajib (tak ada dompet default). Mencabut semua akses seorang user: `user-admin.js disable` (token ikut ditolak ≤30 dtk) atau user mencabut token sendiri.

## 8. Menambah env di VPS (tanpa build)

`.env` VPS **tidak** dikelola git/CD. Edit manual via SSH, lalu `docker compose -f docker-compose.prod.yml up -d` (bukan `--build`). Setiap fase yang butuh env baru
mencantumkannya di Progress Log **sebelum** deploy. Jangan menempel rahasia ke chat/repo.

## 9. Rollback cepat aplikasi

```bash
IMAGE_TAG=<sha-commit-sebelumnya> docker compose -f docker-compose.prod.yml up -d
```
Tag SHA tersedia di GHCR (`ghcr.io/arzakaraffan/trackster-{backend,frontend}`). Aman untuk skema kolom-nullable (F1–F3); **tidak** otomatis aman setelah C1 jika kode lama tak mengisi `userId` — setelah C1 rollback = image sebelumnya yang sudah multi-user.

## 10. Jika curiga OOM / prod bermasalah

Lihat bagian "Kalau curiga OOM" di [`CAUTION.md`](../../CAUTION.md). Setelah pulih: verifikasi manual `curl -I https://trackster.dev` & `https://api.trackster.dev/auth/me` sebelum lapor "sudah pulih".
