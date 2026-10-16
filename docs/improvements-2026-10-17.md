# Perbaikan malam 2026-10-17

Branch: `feat/overnight-improvements` (dari `feat/siklus-gajian`, **belum di-push / belum di-merge**).
Semua diuji di Postgres scratch lokal (5434) dengan user sintetis, bukan data prod.

## Yang berubah untuk pengguna

| # | Fitur | Coba di mana |
|---|---|---|
| 1 | **Catat lewat Telegram tanpa AI** — kirim `kopi 25rb`, `bensin 50rb jago kemarin`, `+gaji 5jt`. Langsung tercatat (kategori dipelajari dari riwayat), ada tombol **Batalkan**. Tidak memakai kuota AI, tetap jalan saat AI mati. | Chat bot Telegram |
| 2 | **`/bisa 350rb`** — sebelum belanja: masih masuk jatah hari ini? jatah N hari ke depan turun ke berapa? uang sampai gajian cukup? Tanya Track memakai hitungan yang sama (tool `checkAffordability`). | Telegram, Tanya Track |
| 3 | **`/hariini`** sisa jatah instan, **`/pagi`** ringkasan tiap 07:00 (opt-in): jatah hari ini, belanja kemarin, tagihan jatuh tempo, sisa siklus. Menu perintah bot terdaftar otomatis. | Telegram, Setting → Telegram |
| 4 | **Langganan terdeteksi otomatis** — tagihan bulanan berulang (≥3×, nominal stabil) muncul sebagai saran; "Tambahkan" membuka form terisi. | Rencana → Langganan |
| 5 | **Kalender .ics** — satu tautan untuk Google/Apple Calendar (semua user, tanpa izin Google). | Langganan → "Salin tautan" |
| 6 | **Bug: jatuh tempo langganan tidak pernah maju** → dulu "Lewat 20 hari" selamanya, pengingat berhenti, dan jatah dinamis tidak lagi memotong langganan. Kini bergulir sendiri. | Langganan, Hari ini |
| 7 | **Pasang sebagai aplikasi (PWA)** — manifest + ikon; "Pasang ke layar utama" kini benar-benar jadi aplikasi (standalone, shortcut Hari ini/Tanya Track/Langganan). | Android Chrome / desktop |
| 8 | **Ekspor CSV lengkap** — pemasukan ikut, jam, nama alias, patungan; terbaca benar di Excel (BOM). | Privasi → Ekspor |
| 9 | Mingguan: di mode dinamis pembelian besar tidak lagi membuat hari "lewat" (sama dengan Hari ini). | Mingguan |
| 10 | Akun tanpa Google tidak lagi melihat "Calendar belum sync" / banner reconnect palsu. | Langganan |

## Optimasi

- **CORS preflight:** tiap GET dulu didahului OPTIONS (header JSON di semua request) → ±30 round trip ekstra tiap buka app di HP. GET kini simple request; preflight sisanya di-cache 2 jam.
- **Tip maskot:** dulu satu panggilan LLM tiap buka halaman / fokus tab; kini di-cache 3 jam per user.
- **SWR:** fokus tab revalidasi maks 1×/menit; data satu layar (token API, riwayat saldo, chat, saran langganan) dimuat hanya di layarnya.
- **Kategori:** riwayat merchant yang sama dipakai sebelum AI (hemat panggilan AI, akurat saat AI mati).
- **DB:** indeks komposit `(userId, occurredAt|receivedAt)` di Transaction/Income/EmailParseLog.

## Migrasi (aman untuk auto-migrate)
- `20261017100000_user_time_indexes` — CREATE/DROP INDEX saja.
- `20261017110000_telegram_daily_brief` — 2 kolom boolean `dailyBrief` default false.

## Cara cek sebelum merge
```bash
cd apps/backend && npm run check && npm run tenancy-audit
```
Lalu merge `feat/siklus-gajian` dulu (branch ini berdiri di atasnya), baru branch ini. Setelah deploy: kirim `kopi 1rb` ke bot → Batalkan.

## Ide berikutnya (belum dikerjakan, urut dampak)
1. **Impor mutasi CSV/PDF** (sudah "SEGERA" di galeri) — isi riwayat lama & bank yang belum didukung.
2. **Deteksi pemasukan rutin** — kebalikan saran langganan: transfer masuk bulanan dari pengirim sama → usul sumber pemasukan (memperbaiki forecast & mode siklus).
3. **Peringatan dini 80% jatah** (opt-in) — riset aplikasi "safe-to-spend" menekankan umpan balik sebelum lewat, bukan sesudah.
4. **Landing tanpa render client** — teks landing belum ada di HTML awal (SEO/LCP).
5. Tombol "Tambahkan saran" langsung dari ringkasan pagi Telegram.

Sumber riset: ulasan aplikasi budgeting 2026 (Monarch/Copilot/YNAB — fitur yang paling dihargai: kategorisasi otomatis, recurring/subscription, review cepat, desain) dan artikel aplikasi "safe-to-spend" harian (satu angka harian + pencatatan cepat + umpan balik harian mengubah kebiasaan lebih dari grafik).
