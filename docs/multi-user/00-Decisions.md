# 00 — Keputusan (Decision Log)

Status: **LOCKED** = diputuskan Arzaka (jangan dibuka ulang tanpa alasan kuat) · **PROPOSED** = rekomendasi, belum disetujui
(sesi AI harus menanyakan sebelum mengerjakan bagian yang bergantung padanya) · **OPEN** = belum ada jawaban.
Mengubah status ke LOCKED hanya setelah Arzaka menyetujui di chat. Catat tanggal.

## A. LOCKED (dari Arzaka)

| ID | Keputusan | Tanggal |
| --- | --- | --- |
| D1 | **Invite-only** untuk tester. Tidak ada signup publik sekarang. Arzaka membuat user; user melewati wizard + tutorial. | 2026-10-05 |
| D2 | **Gmail OAuth ditinggalkan untuk user baru.** Sumber email bank = **forwarding** ke alamat unik per user (sistem tidak boleh bisa melihat email lain). | 2026-10-05 |
| D3 | **Cloudflare**: nameserver `trackster.dev` dipindah dari name.com ke Cloudflare (registrar tetap name.com); Cloudflare Email Routing + Email Worker menerima email. (Opsi 1.) Domain produksi = `trackster.dev` (bukan `trackster.my.id`). | 2026-10-05 |
| D4 | Job terjadwal dibuat **per user** (atau diperlambat); tidak ada polling Gmail untuk user baru. | 2026-10-05 |
| D5 | Konfigurasi hardcode-ke-Arzaka (`OWNER_*`, Telegram, parser) dijadikan per user & general. | 2026-10-05 |
| D6 | **API token per user** untuk Shortcut/input manual + halaman generate/cabut. | 2026-10-05 |
| D7 | Auth: signup (via undangan) + reset password. Aturan "auth flow settled" di CLAUDE.md direvisi **terbatas** sesuai roadmap. | 2026-10-05 |
| D8 | Wizard + tutorial untuk user baru; Arzaka membuat user. | 2026-10-05 |
| D9 | **Tidak ada build/implementasi sebelum dokumentasi ini selesai.** Hasil harus "sempurna, tanpa kesalahan" → verifikasi ketat. | 2026-10-05 |

## B. PROPOSED (butuh persetujuan Arzaka sebelum dikerjakan)

| ID | Usulan | Alasan | Alternatif | Fase terdampak |
| --- | --- | --- | --- | --- |
| P1 | **`userId` eksplisit** sebagai parameter service + kolom `userId` required di Prisma + tes isolasi + skrip audit statis. Bukan AsyncLocalStorage "magis" / Prisma extension otomatis / RLS dulu. | Mudah di-grep, dicek tipe (Prisma mewajibkan `userId` di `create`), cron/ingest tak punya "request" sehingga ALS tak cocok. | Postgres RLS sebagai lapis kedua (Fase 9, opsional); Prisma `$extends`. | 2 |
| P2 | **Satu bot Telegram bersama** (bot milik Arzaka). User menautkan lewat kode: Settings → "Hubungkan Telegram" → kirim `/start <kode>` ke bot. Tabel `TelegramConfig` per-user diganti `TelegramLink(userId, chatId)`. | Tester tak perlu bikin bot via BotFather; satu webhook & satu secret; token bot tak tersimpan per user. `TELEGRAM_BOT_TOKEN` sudah diteruskan di `docker-compose.prod.yml` tetapi **tidak dibaca kode manapun** saat ini (kode membaca token dari tabel `TelegramConfig`) — verifikasi nilainya = token bot yang dipakai Arzaka sekarang sebelum memakainya. | Bot per user (tiap tester bikin bot) — rumit & token tersimpan di DB. | 3 |
| P3 | **Arzaka juga pindah ke forwarding** lewat *shadow mode* ≥ 7 hari (forwarding mem-parse tapi tidak menulis; dibandingkan dengan hasil Gmail), lalu cutover. Modul Gmail dipertahankan **owner-only** sampai cutover, lalu dihapus. | Membuktikan parser bekerja pada format email hasil-forward sebelum tester bergantung padanya. Mencegah transaksi ganda. | Arzaka tetap Gmail selamanya (dua jalur dipelihara terus). | 7 |
| P4 | **Pembuatan user lewat CLI/skrip** (`npm run user:invite` → cetak link undangan sekali pakai) dulu; UI admin ditunda. | ≤5 user; UI admin = pekerjaan ekstra tanpa nilai nyata sekarang. | Halaman admin di app. | 5 |
| P5 | **Zona waktu WIB-only v1.** Dicatat sebagai keterbatasan (user WITA/WIT melihat batas hari WIB). | `common/wib.ts` dipakai di seluruh kode (minggu, budget harian, cron). Per-user TZ = refactor besar. | `User.timezone` + refactor `wib.ts`. | — |
| P6 | **Worker meneruskan raw MIME** (`message/rfc822` + metadata di header) ke `POST /ingest/email`; backend mem-parse dengan `mailparser`. | Worker (free plan) punya batas CPU kecil; parsing MIME di backend; Worker cuma beberapa baris. Perlu dependency `mailparser` (+ tipe). | Parse di Worker dengan `postal-mime`, kirim JSON. | 7 |
| P7 | **`Idempotency-Key`** (header) wajib untuk `/ingest/transaction|income`; kunci → `emailId = "ing:<userId>:<key>"`. | Shortcut iOS bisa retry; mencegah dobel catat. | Dedup heuristik (jumlah+waktu). | 6 |
| P8 | **Expand → backfill → contract**, branch panjang `feat/multi-user`, merge per fase hanya bila backward-compatible. | CD auto-deploy + auto-migrate di prod. | Big-bang merge (ditolak: terlalu berisiko). | semua |
| P9 | **Kuota AI per user** (mis. N pesan chat/hari, kategorisasi tak dibatasi tapi di-cache) + penghitung penggunaan. | `AI_API_KEY` dibagi semua user (biaya & rate limit ditanggung Arzaka). Angka N = OPEN (O3). | Tanpa kuota (berisiko biaya). | 9 |
| P10 | **Tidak menyimpan isi (body) email mentah.** Hanya hasil parse + `from`/`subject` (sudah ada di `EmailParseLog`). Email non-bank (domain tidak di allowlist) **dibuang** tanpa disimpan. Tombol opt-in "kirim contoh email ini ke admin" untuk email UNPARSED. | Minimasi data; privasi; repo/DB tak jadi gudang email pribadi. | Simpan raw untuk debug. | 7 |
| P11 | **Google Calendar (reminder langganan) = owner-only** setelah Gmail OAuth dihapus untuk user baru; user lain mendapat reminder via Telegram. **Terverifikasi (audit 2026-10-05):** reminder langganan saat ini HANYA lewat Google Calendar (`subscription.service.ts`, tidak ada reminder Telegram) — jadi untuk user non-owner perlu dibuat cron reminder Telegram baru (kecil) atau dinyatakan "belum ada reminder" di v1 (Arzaka memilih; O9). | Calendar memakai token OAuth yang sama dengan Gmail (`GmailAuthService.getCalendarClient`). Scope `calendar.events` sensitif, bukan restricted, tapi tetap butuh OAuth per user. | Calendar OAuth terpisah per user (scope kecil) di fase belakangan. | 4 |
| P12 | **Budget tetap per-hari-dalam-minggu (`DailyBudget`) di v1.** Pemasukan bulanan sudah didukung `IncomeStream.cadence=MONTHLY` (forecast mingguan sudah menangani `payDayOfMonth`). Budget bulanan = fitur lanjutan, bukan bagian migrasi ini. | Menjaga cakupan migrasi tetap terkendali. | Mode budget bulanan. | — |
| P13 | `User.id=1` (user Arzaka yang ada) dipertahankan sebagai **ADMIN**; semua data lama di-backfill ke user ini. | Tidak ada pemindahan data; ID stabil. **Verifikasi dulu** bahwa id Arzaka memang 1 (query `SELECT id,username FROM "User"`). | — | 1 |
| P14 | Login memakai **username** (seperti sekarang); kolom `email` opsional (kontak/reset). Reset password = **admin-issued link sekali pakai** (kamu yang kirim manual) di v1; reset mandiri via email = ditunda. | Tidak butuh layanan pengirim email keluar. | SMTP/Resend untuk reset mandiri. | 5 |

## C. OPEN (butuh jawaban Arzaka)

| ID | Pertanyaan | Dibutuhkan sebelum |
| --- | --- | --- |
| O1 | Apakah ada record DNS lain di name.com untuk `trackster.dev` yang harus dibawa (MX apex, TXT verifikasi, CAA)? Apakah **DNSSEC** aktif di name.com? (Harus dimatikan sebelum ganti NS.) | Fase 7 (runbook DNS) |
| O2 | Berapa maksimum user tester (menentukan perlu/tidaknya batas di sistem)? Usulan: hard cap 10 lewat env `MAX_USERS`. | Fase 5 |
| O3 | Angka kuota AI per user per hari? | Fase 9 |
| O4 | Teks privasi: apakah halaman `/app/privacy` perlu ditulis ulang untuk kondisi multi-user (siapa admin, apa yang admin bisa lihat, penghapusan akun)? Arzaka secara teknis bisa membaca DB — harus dijelaskan jujur ke tester. | Fase 9 (sebelum undang tester pertama) |
| O5 | Kebijakan hapus akun & ekspor data (usulan: ekspor JSON + hapus permanen oleh admin atas permintaan, 1 perintah skrip). | Fase 9 |
| O6 | Daftar bank/dompet yang tester pakai (menentukan parser baru yang dibutuhkan; parser sekarang: BCA, Jago, Flip, BNI, Mandiri, Raya, BRI). | Fase 8 (untuk "bank yang didukung" di wizard) |
| O7 | Perangkat tester: iPhone semua (Shortcuts) atau ada Android (perlu alternatif: HTTP Shortcuts/Tasker/aplikasi, atau Telegram sebagai jalur input)? | Fase 6 |
| O8 | Nama/alamat inbound: `in.trackster.dev` (usulan) — setuju? | Fase 7 |
| O9 | Reminder langganan untuk non-owner: bikin cron reminder Telegram (kecil, ~½ hari), atau v1 tanpa reminder? | Fase 4 |

## D. Catatan konsekuensi dari keputusan terkunci

- **D2 + P11:** menghapus Gmail OAuth untuk user baru otomatis menghapus Google Calendar untuk mereka (token sama).
- **D3:** domain sudah `trackster.dev` di Nginx & workflow CD, tetapi `.env.example`, `CLAUDE.md`, `CAUTION.md` masih menyebut `trackster.my.id`.
  Rapikan di Fase 0. Nginx `trackster.conf` masih memuat redirect domain lama (`track.trackster.my.id`) — biarkan sampai Arzaka bilang boleh dihapus.
- **D1:** karena invite-only, "tidak ada signup" tetap benar untuk publik; endpoint register hanya menerima kode undangan valid.
- **D6 + audit:** `/income/quick` saat ini menerima `JWT_SECRET` dan `TELEGRAM_WEBHOOK_SECRET` sebagai kunci, dan kunci bisa lewat query string
  (masuk log Nginx). Setelah token per-user dirilis, secret itu harus dianggap **terpapar** → rotasi `JWT_SECRET` (efek: semua sesi login keluar).
