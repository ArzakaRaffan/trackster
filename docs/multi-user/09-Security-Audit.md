# 09 — Audit Keamanan 2026-10-10

Audit white-box seluruh backend (NestJS), frontend (Next.js), konfigurasi deploy (Docker/Nginx/CI), dependensi, dan riwayat git.
Target: kode `origin/main` (= prod) per commit `1d5e8af`; modul `inbound` (P7-04) dicek di `feat/multi-user`.
Perbaikan ada di branch `fix/security-audit` (turunan `origin/main`) — lihat bagian 3 untuk cara deploy.

Metode: baca semua controller/guard/DTO/endpoint publik, cari pola IDOR (`where: { id }` tanpa `userId`), raw SQL, injeksi
query, header, dependensi (`npm audit`), pindai riwayat git untuk rahasia, lalu serang backend uji (DB scratch) lewat
`apps/backend/scripts/security-e2e.mjs`.

## 1. Temuan & status

| # | Tingkat | Temuan | Status |
| --- | --- | --- | --- |
| S1 | Kritis | **Next.js 14.2.5**: CVE-2025-29927 (bypass middleware), cache poisoning, DoS, dan (di 14.x mana pun) 2 RCE Image Optimizer + SSRF/DoS Server Components yang hanya ditambal di 15.5.24+. Next 14 sudah EOL. | **Diperbaiki**: Next 15.5.27 + React 19 (4 file `params` → async). |
| S2 | Tinggi | `PUT /telegram/config` menerima `chatId` bebas dari user mana pun → bot bersama (token env) bisa disuruh mengirim pesan HTML ke chat siapa pun (spam/phishing atas nama Trackster), dan chat yang belum tertaut dipetakan ke user penyerang. | **Diperbaiki**: chat ID/bot token manual hanya untuk pemilik; member wajib kode `/start` (UI baru: tombol Hubungkan → dialog kode). Cek bentrok juga ke `TelegramLink`. |
| S3 | Tinggi | Dependensi backend: `node-telegram-bot-api` membawa `request` usang (SSRF, `form-data` CRLF, `tough-cookie`), `bcrypt` 5 membawa `tar` rentan (path traversal saat install). | **Diperbaiki**: library Telegram diganti `fetch` (3 method), `bcrypt` 6 (prebuild musl tersedia). Critical backend 3 → 0. |
| S4 | Sedang | Tak ada batas pemakaian AI per user; pesan chat tanpa batas panjang → satu akun undangan bisa menguras biaya/kuota AI (web & bot Telegram). | **Diperbaiki**: `AiRateLimitGuard` 20/mnt & 300/hari per user per rute (chat, stream, scan struk, saran kategori, tip, kartu insight, trigger), kuota sama untuk chat Telegram; `MaxLength` 4000 pada pesan. |
| S5 | Sedang | Pesan Telegram `parse_mode: HTML` menyisipkan teks dari email bank/AI/nama tanpa escape → tag/link bisa disuntik (deskripsi dari email palsu, prompt injection) atau pesan gagal terkirim. | **Diperbaiki**: `escHtml()` di semua template (alert, notif transaksi/pemasukan, laporan, anomali, recap, check-in, saran budget, balasan chat). |
| S6 | Sedang | JWT `state` OAuth Gmail ditandatangani `JWT_SECRET` yang sama dan **diterima sebagai cookie sesi** (token-type confusion). | **Diperbaiki**: guard menolak payload ber-`purpose` / `sub` non-integer. |
| S7 | Sedang | Kunci login per username hanya 1 menit → ±14.000 tebakan/hari/username dengan IP berganti. `LoginDto` tanpa batas panjang. | **Diperbaiki**: 10 gagal / 15 menit (≈960/hari maks), map dibatasi; `MaxLength`. Efek samping: orang lain bisa mengunci username selama 15 menit (diterima). |
| S8 | Sedang | Ekspor CSV: deskripsi dari email (bisa dipalsukan) ditulis apa adanya → formula injection saat dibuka di Excel/Sheets; `from`/`to` tak divalidasi (masuk header `Content-Disposition`). | **Diperbaiki**: `csvText()` menetralkan `= + - @ \t \r`, tanggal wajib `YYYY-MM-DD` (`csv.check.ts`). |
| S9 | Rendah | Query parser Express `extended`: `?source[not]=X` menjadi objek yang lolos ke filter Prisma; `limit` tanpa batas. | **Diperbaiki**: `query parser = simple`, `limit` dijepit 1–500, `page ≥ 1`. |
| S10 | Rendah | Tanpa header keamanan (clickjacking, sniffing, HSTS, referrer) dan `X-Powered-By` bocor di API & frontend; respons API keuangan bisa di-cache. | **Diperbaiki**: API: nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, HSTS (prod). Frontend: CSP `frame-ancestors 'none'; base-uri; object-src; form-action`, XFO, nosniff, Referrer-Policy, Permissions-Policy, HSTS, `poweredByHeader:false`. |
| S11 | Rendah | DTO publik Split Bill/Trip tanpa batas panjang/jumlah/nilai; `shares` bebas bentuk (`participantIndex:"__proto__"`). | **Diperbaiki**: `MaxLength(200)`, `ArrayMaxSize(200)`, `Max(9.999.999.999)`; indeks & bobot share divalidasi manual. |
| S12 | Rendah | Secret webhook Telegram dibandingkan dengan `!==` (bukan timing-safe). | **Diperbaiki**: `timingSafeEqual` atas hash. |
| S13 | Rendah | SSE chat mengirim `err.message` mentah (bisa berisi detail provider AI). | **Diperbaiki**: hanya pesan `HttpException`; selain itu pesan generik. |
| S14 | Rendah | `opengraph-image` menyisipkan slug ke URL fetch tanpa encode. | **Diperbaiki**: `encodeURIComponent`. |
| S15 | Rendah | HMAC `/ingest/email` (P7-04) tidak menutupi header `X-Trackster-To` → request tertangkap bisa diputar ulang ke alamat lain dalam 5 menit. | **Diperbaiki di `feat/multi-user`**: string yang ditandatangani = `ts.to.sha256(body)` (Worker belum dibuat, jadi belum ada yang rusak). |

Lolos audit (tidak ada masalah): isolasi tenant (`tenancy-audit` 0 temuan; semua by-id memakai `{id, userId}`; raw SQL
terparameter & ber-`userId`), mass-assignment (`ValidationPipe whitelist`, tak ada DTO ber-`userId`), CORS (satu origin),
CSRF (cookie `SameSite=Lax` + JSON + CORS), token API (SHA-256, CSPRNG, Bearer saja), undangan/reset (192 bit, hash,
sekali pakai), tool AI terikat `userId` server, SSRF scan struk (hanya data URL), XSS frontend (tak ada `dangerouslySetInnerHTML`
untuk data; ikon divalidasi regex), riwayat git (tak ada token/kunci; hit `AIza…` = potongan gambar base64).

## 2. Belum diperbaiki — butuh keputusan/aksi Arzaka

| # | Tingkat | Hal | Rekomendasi |
| --- | --- | --- | --- |
| R1 | Sedang | Rotasi rahasia lama: `/income/quick` dulu menerima `JWT_SECRET` & `TELEGRAM_WEBHOOK_SECRET` sebagai kunci (dihapus di P6-06). | `JWT_SECRET` sudah dirotasi (dikonfirmasi Arzaka 2026-10-10). Sisa: rotasi `TELEGRAM_WEBHOOK_SECRET` (+ `setWebhook` ulang). |
| R2 | Sedang | Sisa advisory backend (tanpa critical): `@nestjs/platform-express`/`multer`/`lodash`/`body-parser` — perbaikan hanya di Nest 11/12 (major). Jalur rentan tak terjangkau (tak ada upload file, `_.template` tak dipakai, limit body tak diubah). | Rencanakan upgrade Nest 11 terpisah (Express 5, uji penuh). |
| R3 | Sedang | Email masuk (F7) bisa dipalsukan oleh siapa pun yang tahu alamat inbound user (header From tak diverifikasi). | Lanjutkan P7-06: cek DKIM bank sebelum cutover. |
| R4 | Rendah | Kontainer backend & frontend jalan sebagai root. | `USER node` (+`chown` cache Next) — butuh uji `docker build` (Docker tidak tersedia di sesi audit). |
| R5 | Rendah | Postgres prod ikut jaringan `shared-web-net` (bisa dijangkau kontainer proyek lain di VPS). | Lepas dari `shared-web-net` bila tak ada proyek lain yang memakainya. |
| R6 | Rendah | Refresh token Gmail & bot token Telegram lama tersimpan plaintext di DB. | Hilang bersama Gmail OAuth/`TelegramConfig` di F7/contract. |
| R7 | Info | Logout tidak mencabut JWT di server (berlaku s.d. 7 hari bila cookie tercuri). | Pakai "Keluar di semua perangkat" bila curiga; opsional: logout menaikkan `tokenVersion`. |
| R8 | Info | Prototipe v3 (`logic.tsx`, `.dc.html`) & fixture parser memuat nama lengkap + nomor rekening yang tampak asli, di repo publik. | Bila asli: ganti dengan data rekaan (riwayat git tetap menyimpan versi lama). |
| R9 | Info | Kebocoran sesi audit: perintah redaksi gagal sehingga `JWT_SECRET` lokal & `GMAIL_CLIENT_SECRET` dari `apps/backend/.env` tercetak di transkrip sesi Claude. | Rotasi client secret Google OAuth bila sama dengan prod. |

## 3. Verifikasi (DB scratch lokal, bukan prod)

- Backend: `tsc` bersih; `npm run build` bersih; `npm run check` 25/25 (termasuk `csv.check.ts` baru); `tenancy-audit` 0.
- `scripts/security-e2e.mjs` **10/10** (header, JWT purpose, Telegram config member 403/pemilik 200, webhook secret, query
  bertingkat, CSV, isolasi, kuota AI 429, split bill publik, kunci login). `auth-e2e` 9/9, `ingest-e2e` 18/18,
  `isolation-e2e` 176/176 (ekspektasi lama "`/balance` B = `[]`" disesuaikan: pendaftaran via undangan membuat baris saldo 0
  milik B sendiri — bukan kebocoran).
- Frontend: `tsc` bersih, `next build` (Next 15.5.27) lolos; browser: login → dashboard, semua request API 2xx, console bersih;
  halaman publik (`/s/<slug>` + OG image, `/invite/<kode>`, `/reset/<token>`, kalkulator, legal) 200; header terpasang;
  member: Setting → Telegram → dialog kode → `/start` via webhook → status AKTIF.

**Deploy:** merge `fix/security-audit` ke `main` = auto-deploy (tak ada migrasi DB, tak ada env baru). Sesudahnya: R1.
Catatan: env opsional `AI_RATE_PER_MIN`/`AI_RATE_PER_DAY` hanya untuk tes — jangan diset di prod.
