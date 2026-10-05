# Migrasi Multi-User Trackster — Panduan Utama (BACA INI DULU)

> **Status:** perencanaan selesai, implementasi **belum dimulai** (lihat [`08-Progress-Log.md`](08-Progress-Log.md) untuk status terkini).
> **Pemilik keputusan:** Arzaka (satu-satunya yang boleh menyetujui keputusan di [`00-Decisions.md`](00-Decisions.md)).
> **Tujuan tertinggi:** migrasi ini harus **tanpa kesalahan** — tidak ada data bocor antar user, tidak ada data Arzaka yang
> hilang/berubah, tidak ada prod down. Kalau ragu, **berhenti dan tanya**, jangan menebak.

Dokumen ini dibaca oleh **setiap sesi AI** yang mengerjakan migrasi. Sesi AI tidak punya ingatan antar sesi — semua konteks
ada di folder ini. Jangan eksplorasi dari nol kalau jawabannya ada di sini.

---

## 1. Apa yang berubah

Trackster dulu **single-user** (hanya Arzaka). Targetnya: **multi-user invite-only** untuk tester terpilih (≤ ~5 orang dulu).
Arzaka membuat akun mereka, mereka masuk lewat wizard + tutorial, lalu memakai app penuh.

Perubahan besar yang sudah diputuskan (detail di [`00-Decisions.md`](00-Decisions.md)):

1. **Isolasi data per user** — hampir semua tabel dapat `userId`; semua query di-scope.
2. **Email bank via forwarding** (bukan Gmail OAuth) — user mem-forward email bank ke alamat unik; Cloudflare Email Routing +
   Worker mendorongnya ke backend. Cron polling Gmail hilang untuk user baru.
3. **Konfigurasi per user** — `OWNER_FULL_NAME`/`OWNER_ACCOUNT_NUMBERS` (env) → profil per user; Telegram per user; parser dapat
   konteks pemilik.
4. **API token per user** — untuk Shortcut iPhone / input manual (menggantikan secret global di `/income/quick`).
5. **Auth** — signup via undangan, ganti & reset password, revoke sesi.
6. **Onboarding** — wizard nyata (bukan tampilan saja) + tutorial + checklist aktivasi.
7. **Pemasukan** — sudah fleksibel (mingguan/bulanan/dll lewat `IncomeStream`); wizard tinggal menawarkannya.

## 2. Peta dokumen

| File | Isi | Kapan dibaca |
| --- | --- | --- |
| [`00-Decisions.md`](00-Decisions.md) | Keputusan terkunci / diusulkan / terbuka | Awal sesi; sebelum menyentuh area yang punya keputusan OPEN |
| [`01-Current-State-Audit.md`](01-Current-State-Audit.md) | Inventaris kondisi kode saat ini + titik rawan | Sebelum mengerjakan fase manapun |
| [`02-Target-Architecture.md`](02-Target-Architecture.md) | Desain data/auth/ingest/Telegram/cron/AI target | Saat implementasi |
| [`03-Roadmap.md`](03-Roadmap.md) | Fase 0–9 + tugas bercentang + exit criteria + rollback | **Setiap sesi** (cari fase aktif) |
| [`04-Checklist.md`](04-Checklist.md) | Checklist lintas-fase (matriks scoping, pre-merge, pre-deploy, update docs) | Sebelum merge/deploy |
| [`05-Security-Testing.md`](05-Security-Testing.md) | Threat model + rencana tes isolasi + protokol verifikasi | Fase 2, 6, 7, 9 |
| [`06-Runbooks.md`](06-Runbooks.md) | Prosedur operasional (backup, migrasi, DNS Cloudflare, cutover, rollback) | Saat menyentuh DB/DNS/deploy |
| [`07-Onboarding-UX.md`](07-Onboarding-UX.md) | Spek wizard, tutorial, checklist aktivasi, zero-state | Fase 8 |
| [`08-Progress-Log.md`](08-Progress-Log.md) | Log kerja per sesi (append-only) | Awal & akhir **setiap** sesi |

## 3. Protokol sesi (WAJIB)

### 3.1 Awal sesi — urutan baca

1. **[`/CAUTION.md`](../../CAUTION.md)** — VPS cuma 2GB RAM; pernah bikin prod down. Aturan memori & satu-proses-berat-sekaligus
   berlaku penuh. Tanpa membaca ini, jangan jalankan build/start apapun.
2. **[`/CLAUDE.md`](../../CLAUDE.md)** — konvensi proyek, domain logic (parser, saldo live-incremental), gotcha infra.
3. `docs/context/_Overview.md`, `Architecture.md`, `Codemap.md`. Kalau ada (lokal saja, di-gitignore): `Decisions.md`, `Gotchas.md`, `Product.md`.
4. **Folder ini**: `README.md` (ini) → `08-Progress-Log.md` (entri terakhir) → bagian fase aktif di `03-Roadmap.md`.
5. `git status` + `git branch --show-current`. Pastikan di branch kerja yang benar (lihat §4), bukan `main`.
6. Beri tahu Arzaka: fase apa, tugas apa, apa yang akan dikerjakan sesi ini. Tunggu "ya" untuk hal yang menyentuh data/prod.

### 3.2 Selama sesi

- Kerjakan **satu fase** (idealnya satu kelompok tugas) pada satu waktu. Jangan loncat fase; fase punya prasyarat.
- Centang tugas di `03-Roadmap.md` **hanya setelah** diverifikasi (bukan sekadar lolos compile — lihat §5).
- Keputusan baru / temuan yang mengubah rencana → tulis di `00-Decisions.md` (status OPEN → tanya Arzaka) dan `08-Progress-Log.md`.
- Commit per unit kerja logis, pesan jelas (konvensi repo: `feat(scope): ...`). Jangan satu commit raksasa.
- Berhenti dan tanya Arzaka bila menyentuh **Stop Conditions** (§6).

### 3.3 Akhir sesi (jangan dilewati — ini yang bikin sesi berikutnya aman)

1. Centang/uraikan tugas di `03-Roadmap.md`.
2. Tambah entri di `08-Progress-Log.md` (apa selesai, apa belum, deviasi, langkah berikutnya yang konkret).
3. **Update docs konteks** yang terdampak (daftar lengkap di [`04-Checklist.md` §E](04-Checklist.md)): `docs/context/Codemap.md`,
   `Architecture.md`, `_Overview.md`, `CLAUDE.md`, `.env.example`.
4. Matikan proses background (dev server, dev Postgres) — aturan CAUTION.
5. Jangan `git push` / merge ke `main` tanpa persetujuan eksplisit Arzaka (push ke `main` = **auto-deploy ke prod**).

## 4. Aturan git & deploy

- `main` auto-deploy ke VPS lewat GitHub Actions. Migrasi Prisma jalan **otomatis** tiap container backend start
  (`npx prisma migrate deploy` di CMD Dockerfile). Artinya: **migrasi yang cacat yang ter-merge ke `main` langsung menyentuh DB prod.**
- Kerja di branch panjang `feat/multi-user` (turunan `main`). Merge ke `main` **per fase**, hanya bila fase itu:
  (a) lolos semua verifikasi §5, (b) **backward-compatible** (prod tetap normal untuk Arzaka sebagai satu-satunya user),
  (c) disetujui Arzaka, (d) sudah ada backup DB segar ([`06-Runbooks.md` §1](06-Runbooks.md)).
- Pola migrasi DB: **expand → backfill → contract** (lihat `02-Target-Architecture.md` §Migrasi). Jangan pernah dalam satu migrasi:
  menambah kolom NOT NULL tanpa default pada tabel berisi data.
- Repo ini **PUBLIC**. Jangan commit: rahasia, token, kredensial, data pribadi/finansial nyata (termasuk contoh email bank
  asli — anonimkan), isi `.env`. File konteks sensitif di-gitignore (`docs/context/{Decisions,Gotchas,Product}.md`).

## 5. Definisi "selesai" (Definition of Done) untuk setiap tugas kode

Konvensi proyek (CLAUDE.md): lolos compile **tidak cukup**. Semua ini harus terpenuhi:

1. Backend: `NODE_OPTIONS=--max-old-space-size=1536 npm run build` di `apps/backend` (lihat CAUTION — cap wajib, satu proses berat sekaligus).
2. Frontend: `npx tsc --noEmit` di `apps/frontend`.
3. Semua skrip `*.check.ts` yang relevan lulus (pola proyek: skrip assert murni via `ts-node`, tanpa framework). Fase 0 menambah
   agregator `npm run check`.
4. Tes isolasi tenant ([`05-Security-Testing.md`](05-Security-Testing.md)) lulus untuk modul yang disentuh.
5. **Verifikasi hidup di browser** (preview tool / Chrome): jalankan alur yang berubah dengan user nyata (Arzaka + user uji). Cek console + network.
6. Perbandingan "golden snapshot" Arzaka sebelum/sesudah (Fase 0 membuat alatnya): output endpoint kunci untuk data Arzaka
   **identik** setelah perubahan scoping.
7. Docs terkait sudah di-update (§3.3).

## 6. Stop Conditions — berhenti & tanya Arzaka

- Operasi apapun yang **mengubah/menghapus data** di DB prod (migrasi, backfill, script) — wajib backup + konfirmasi.
- Mengubah DNS / nameserver / record Cloudflare/name.com.
- Mengubah aliran auth/cookie di luar yang tertulis di roadmap (CLAUDE.md: "auth flow settled — jangan diubah tanpa alasan kuat").
- Status keputusan OPEN di [`00-Decisions.md`](00-Decisions.md) yang menghalangi tugas.
- Hasil verifikasi tidak cocok dengan ekspektasi (golden snapshot beda, tes isolasi gagal) — **jangan "diperbaiki sampai hijau" dengan menebak**; cari akar masalah, laporkan.
- Perlu menambah dependency baru yang bukan di rencana.
- Tiga kali berturut-turut "masih rusak" → berhenti iterasi, tulis asumsi yang mungkin salah, tanya satu pertanyaan diagnostik.

## 7. Invarian domain yang TIDAK BOLEH rusak (berlaku **per user**)

Dari CLAUDE.md — setelah multi-user, tiap aturan berlaku di dalam scope satu user:

1. Saldo bank **live incremental**, tidak pernah dihitung ulang dari agregat; semua gerak saldo di dalam `prisma.$transaction` bersama operasi utamanya.
2. Aturan baseline vs backfill: `getLastManualAdjustmentAt` + `shouldAdjustBalance` → per `(userId, source)`.
3. `BalanceAdjustment` hanya untuk koreksi manual.
4. `ParseResult.balanceOnly` → debit saldo tanpa `Transaction`, dedup via `EmailParseLog.status=EXCLUDED` (tidak boleh dobel-debit).
5. Dedup email: `EmailParseLog.status=RECORDED` bertahan walau transaksi dihapus (mencegah regenerasi) — kunci jadi `(userId, emailId)`.
6. Exclusion rules parser (BCA→FLIPTECH exclude; Flip ke diri sendiri `balanceOnly`; "multiple destinations" → `null`; GoPay tidak diproses) — berlaku sama, hanya "diri sendiri" kini = profil user yang bersangkutan.
7. Split Bill / Trip **tetap terisolasi** dari `Transaction`/`BankBalance`; alur publik (slug/ownerToken tanpa login) tidak boleh rusak.
8. Minggu = Senin–Minggu, zona WIB (`common/wib.ts`). v1 tetap WIB-only (keputusan P5).
9. Auth: JWT httpOnly cookie, `COOKIE_DOMAIN` lintas-subdomain — **bentuk cookie tidak berubah**; yang bertambah hanya validasi status user.

## 8. Jika sesi kamu menemukan dokumen ini keliru

Dokumen ini ditulis dari audit kode per 2026-10-05. Kalau kenyataan kode berbeda: **kode adalah kebenaran**. Perbaiki dokumen
(dan catat di Progress Log) — jangan ikuti dokumen secara buta, jangan juga diam-diam menyimpang.
