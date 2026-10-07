# 05 — Keamanan & Rencana Pengujian

Tujuan: **tidak ada kebocoran data antar user** dan tidak ada jalur masuk baru yang bisa dieksploitasi. Karena tidak ada test runner di repo, verifikasi memakai
skrip assert + e2e HTTP + audit statis + uji hidup (pola proyek). Dokumen ini = apa yang diuji dan bagaimana.

## 1. Threat model (ringkas)

| # | Ancaman | Vektor | Mitigasi (fase) |
| --- | --- | --- | --- |
| T1 | **Kebocoran data antar user (IDOR / query tanpa filter)** | `findUnique({id})` tanpa cek pemilik; `findMany()` tanpa where; `updateMany/deleteMany` tanpa user; cache/unik global | `userId` eksplisit + FK required; by-id selalu `{id,userId}`; **audit statis**; **tes isolasi e2e** (F2) |
| T2 | Kebocoran lewat **raw SQL / pencarian** | `retrieval.service.ts` tsvector atas semua pesan | Join thread + `userId` terparameter; tes (F2) |
| T3 | **Prompt injection → akses data user lain** | email/merchant/nama transaksi berisi instruksi ke LLM; model memanggil tool dengan argumen | `userId` terikat server pada eksekutor tool, tak dari argumen; tool read-only kecuali `logExpense`; tes (F2/F9) |
| T4 | **Spoofing email** → transaksi palsu | pihak ketiga tahu/menebak alamat inbound | alamat acak ≥ 96 bit; `gmailSource` cocok; allowlist domain bank; DKIM bila terbukti stabil; parser menolak format asing; rotasi alamat (F7) |
| T5 | **Pemalsuan endpoint inbound** | siapa pun memanggil `/ingest/email` | HMAC + timestamp (anti-replay) + batas ukuran; tidak membocorkan "alamat tak dikenal" (200 diam) (F7) |
| T6 | **Pencurian/penyalahgunaan API token** | token Shortcut bocor | simpan hash; tampil sekali; scope INGEST saja (tak bisa baca data); revoke; rate limit; `lastUsedAt` (F6) |
| T7 | **Brute force login / enumerasi** | login berulang | throttler `auth` per IP & per username; pesan galat generik; password ≥ 10 (F5) |
| T8 | **Undangan disalahgunakan** | kode bocor/ditebak | acak ≥ 128 bit, hash, sekali pakai, kedaluwarsa 7 hari, `MAX_USERS` (F5) |
| T9 | **Sesi tak bisa dicabut** | JWT 7 hari; user dinonaktifkan masih lolos | `tokenVersion` + cek status di guard (F5) |
| T10 | **Secret lama terpapar** | `/income/quick` menerima `JWT_SECRET`, kunci di query string (log Nginx) | hapus endpoint, rotasi `JWT_SECRET` (F6) |
| T11 | **Penimpaan token Gmail** via `GET /gmail/callback` publik | pihak ketiga menyelesaikan OAuth dengan akunnya sendiri | `state` bertanda tangan atau hapus jalur (F2/F7) — *sudah ada risikonya hari ini* |
| T12 | **DoS/biaya AI** | satu user memakai kuota AI semua | `AiUsage` kuota; throttler chat (F9) |
| T13 | **Beban VPS 2GB** | N user × cron serentak; parsing email | runner berurutan + jitter; batas ukuran email; parse di backend dengan batas (F4, F7, F9) |
| T14 | **Data sensitif di log/repo** | log body email/token; fixture email asli; repo public | jangan log isi/token; anonimkan fixture; skrip tak menulis rahasia; cek diff (F0–F9) |
| T15 | **Cache frontend lintas akun** | SWR cache di perangkat bersama | logout = reload penuh / kosongkan cache (F5) |
| T16 | **Cloudflare/DNS salah konfigurasi** | NS salah, record hilang, proxy oranye merusak certbot | runbook DNS bertahap, DNS-only, verifikasi `dig` & `certbot --dry-run` (F7) |
| T17 | **Admin (Arzaka) bisa membaca semua data** | akses DB langsung | **transparan ke tester** (O4); minimalkan data (P10); kebijakan hapus/ekspor (O5) |
| T18 | **CSRF** | cookie `sameSite=lax` | mutasi lewat JSON `Content-Type: application/json` + CORS kredensial dibatasi `FRONTEND_URL`; `lax` memblokir POST lintas-situs. Jangan menambah endpoint mutasi via GET |
| T19 | **XSS** dari teks email/merchant | deskripsi transaksi ditampilkan di UI | React meng-escape; jangan `dangerouslySetInnerHTML` untuk data user (periksa `logic.tsx` yang digenerate dari HTML prototipe — pastikan nilai data masuk lewat teks, bukan HTML) |

## 2. Rencana tes isolasi (`apps/backend/scripts/isolation-e2e.ts`)

Pola: plain TS dijalankan `npx ts-node` terhadap backend dev (port 4000) + DB dev (5434) — **bukan** prod. Satu proses berat pada satu waktu (CAUTION): backend dev nyala → jalankan skrip → matikan.

1. **Fixture:** buat user A, B via skrip provisioning (bukan lewat undangan, supaya independen dari F5). Login masing-masing → simpan cookie. Isi data A lewat API/Prisma: 3 transaksi, 2 income + stream, saldo, budget, alias, goal + kontribusi, langganan, thread + pesan bernilai khas ("RAHASIA-A-12345"), memori AI, reimbursement, split bill & trip privat.
2. **Tiga tes per rute** (matriks [04 §C](04-Checklist.md)): list-kosong-untuk-B, by-id-A-oleh-B = 404/403 (dan **data A tidak berubah** — baca ulang sebagai A), tanpa-cookie = 401.
3. **Tes tulis silang:** B mencoba `PATCH/DELETE/PUT` dengan id milik A → ditolak; verifikasi A utuh. B membuat data dengan nilai yang sama (alias `rawDescription`, `dayOfWeek`, `source` BCA, `emailId`) → **tidak bentrok** dan tidak menimpa A (uji constraint komposit).
4. **Tes saldo:** transaksi B tidak menggerakkan saldo A; koreksi manual B tidak memengaruhi aturan baseline A.
5. **Tes AI/raw SQL:** pencarian chat B untuk "RAHASIA-A" → nol hasil; tool `getInsights` B tak memuat angka A.
6. **Tes publik:** Split Bill/Trip anonim tetap bisa dibuat/dibuka via slug/ownerToken tanpa login; bill privat A tak terlihat B.
7. **Tes job:** panggil tiap job per-user (method langsung) untuk A dan B; hasil Telegram (stub/mock `sendMessage`) menyebut `userId` benar; kegagalan A tak menghentikan B.
8. **Tes Telegram webhook:** dua `chatId` berbeda → dua user berbeda; `chatId` asing → diabaikan; kode `/start` kedaluwarsa/terpakai → ditolak.
9. Keluaran: tabel lulus/gagal per rute; **exit code ≠ 0** bila ada yang gagal.

### Audit statis (`scripts/tenancy-audit.mjs`)
- Memindai pemanggilan Prisma pada model tenant; menandai yang tidak memuat `userId` pada `where`/`data`; menandai `findUnique({ where: { id } })` pada model tenant; menandai `$queryRaw` yang tak mengandung `userId`.
- Allowlist: `// tenancy-ok: <alasan>` di baris atas. Tiap pengecualian ditinjau di PR/commit.
- Dijalankan di `npm run check` dan (opsional) CI.

## 3. Tes unit (`*.check.ts`) yang harus ditambah/diubah

| File | Perubahan |
| --- | --- |
| `gmail/parsers/parsers.check.ts` | konteks eksplisit; user B nama berbeda; konteks kosong; fixture email **hasil forward** (anonim); email non-bank → `canHandle` false |
| `balance/balance.check.ts` | baseline per `(user, source)` |
| `income-forecast.check.ts`, `income-checkin.check.ts`, `budget-allocation.check.ts` | tetap lulus; tambah kasus bulanan-only/mingguan-only/kosong |
| `ai/retrieval.check.ts` | filter user |
| `ai/ai-chat.check.ts`, `ai-memory.check.ts` | tool terikat user; memori per user |
| (baru) `inbound/hmac.check.ts` | verifikasi HMAC, timestamp kedaluwarsa, ukuran, signature salah |
| (baru) `inbound/email-id.check.ts` | `emailId` stabil dari `Message-ID`; fallback; email sama dua kali → sama |
| (baru) `auth/invite.check.ts`, `api-token.check.ts` | hash/kedaluwarsa/sekali-pakai/revoke |
| (baru) `common/per-user-runner.check.ts` | error di satu user tidak menghentikan lainnya; urutan; jitter |

## 4. Tes keamanan inbound & token (F6–F7)

- HMAC salah/hilang → 401; timestamp > 5 menit → 401; replay body sama → idempoten (tidak menggandakan transaksi).
- Alamat tak dikenal → 200 tanpa efek (tak ada informasi); alamat nonaktif → idem.
- Email > batas ukuran → ditolak; email non-bank → dibuang (tak ada baris `Transaction`, log hanya hitungan).
- Email bank yang diteruskan ke alamat user A tidak pernah muncul di B.
- Parser fuzz ringan: email bank dengan body korup/HTML aneh/panjang → tidak melempar tak tertangani (status ERROR/UNPARSED, bukan crash).
- Token: tanpa header → 401; token revoked → 401; token user A menulis → data masuk A saja; `Idempotency-Key` sama → satu transaksi; kunci hilang → 400.
- Rate limit: kelebihan → 429.

## 5. Protokol verifikasi hidup (browser)

Gunakan Browser preview/Chrome (CLAUDE.md: verifikasi hidup wajib). Untuk setiap fase:
1. Mulai satu server saja (CAUTION): backend dev dengan cap RAM, frontend dev bila perlu; DB dev sudah hidup. Jangan menjalankan build bersamaan.
2. Dua profil browser (atau jendela incognito) → dua user nyata. Lakukan alur fase pada A, lalu cek B tak terpengaruh.
3. Baca console & network (tak ada 4xx/5xx tak terduga, tak ada data user lain di respons).
4. Bandingkan layar utama Arzaka sebelum/sesudah (golden snapshot + tatap muka).
5. Matikan server & DB dev setelah selesai.

## 6. Kriteria "lulus" sebelum mengundang tester pertama (gerbang F9)

- Audit statis hijau tanpa pengecualian tak beralasan.
- Isolasi e2e hijau (semua baris matriks 04 §C).
- Tinjauan `security-review` + `code-review` pada seluruh perubahan selesai, temuan diperbaiki/diterima tertulis.
- Rotasi secret lama selesai; `/income/quick` & Gmail OAuth hilang.
- Uji hapus akun & ekspor data pada user uji sukses.
- RAM aman pada simulasi beban.
- Teks privasi diperbarui & disetujui Arzaka.
