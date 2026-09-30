repo: ArzakaRaffan/trackster
branch: main
path: apps/frontend

## Last sync
date: 2026-09-30T08:04:22Z

### Updated in this project
- Batch 6: Laporan (minggu, bulan, 6 bulan, semua + cari transaksi)
- Batch 5: Split bill (daftar, wizard 3 langkah, detail, tampilan teman)
- Batch 4: Tanya Track (chat + riwayat + kartu aksi) dan Yang Track ingat
- Batch 3: Setting (koneksi, sinkronisasi, saldo, alias)
- Batch 2: Langganan dan Target tabungan ditambahkan ke Trackster Web v2
- Trackster Web v2: 6 halaman tetap terpisah, isi dibuat compact
- Semua fungsi repo dipertahankan (edit transaksi, CRUD sumber & pemasukan, check-in 5 jenis)

## Screen map
| Screen | Repo files |
|---|---|
| Trackster Web v2 · Dashboard | apps/frontend/src/app/app/page.tsx, src/components/MascotWidget.tsx, src/components/TracksterMascot.tsx |
| Trackster Web v2 · Hari ini | apps/frontend/src/app/app/today/page.tsx |
| Trackster Web v2 · Mingguan | apps/frontend/src/app/app/weekly/page.tsx, src/components/ui/DayBarChart.tsx |
| Trackster Web v2 · Budget | apps/frontend/src/app/app/budget/page.tsx |
| Trackster Web v2 · Pemasukan | apps/frontend/src/app/app/income/page.tsx |
| Trackster Web v2 · Check-in | apps/frontend/src/app/app/income/checkin/page.tsx |
| Trackster Web v2 · Langganan | apps/frontend/src/app/app/subscriptions/page.tsx |
| Trackster Web v2 · Target tabungan | apps/frontend/src/app/app/goals/page.tsx |
| Trackster Web v2 · Setting | apps/frontend/src/app/app/settings/page.tsx |
| Trackster Web v2 · Tanya Track | apps/frontend/src/app/app/chat/page.tsx, src/components/chat/*.tsx |
| Trackster Web v2 · Yang Track ingat | apps/frontend/src/app/app/chat/memory/page.tsx |
| Trackster Web v2 · Split bill | apps/frontend/src/app/split-bills/page.tsx, split-bills/new/page.tsx, split-bills/[id]/page.tsx, s/[slug]/page.tsx |
| Trackster Web v2 · Laporan | apps/frontend/src/app/app/reports/page.tsx |
| Trackster Web v2 · sidebar | apps/frontend/src/components/NavBar.tsx |
| Tokens | apps/frontend/tailwind.config.js, src/lib/format.ts |
