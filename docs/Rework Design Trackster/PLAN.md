# Rencana & status implementasi — Trackster v3 (1:1 dari `Trackster v3 App.dc.html`)

Branch kerja: `feat/v3-redesign`. Push ke `main` sekali di akhir (CD main = auto-deploy prod), setelah `tsc --noEmit` + `npm run build` lolos dan semua layar diverifikasi di browser.

## Keputusan (dari Arzaka)
- Layar pra-app (Daftar, Masuk Google, Lupa password, Wizard setup, Harga/Plus): **visual 1:1, tanpa backend baru**. Produk tetap single-user.
- `docs/Redesign UI/*` yang terhapus di working tree: tidak disentuh / tidak di-commit.

## Pendekatan (kenapa 1:1 terjamin)
1. **Markup digenerate, bukan ditulis ulang.** `apps/frontend/scripts/dc-to-tsx.mjs` mem-parse template `.dc.html` dan menghasilkan komponen per layar
   di `src/components/v3/views/*View.tsx` + `V3Tree.tsx` (kerangka shell) + `pseudo.css` (hover/active/focus dari `style-*`). Nilai (warna, jarak, copy ID, bentuk) datang langsung dari sumber.
2. **Logika prototipe dibawa utuh** (`src/components/v3/logic.tsx`): state, `rv_*`, kamus EN `v3tr()`, modal, form, animasi. Dirawat tangan; cabang `this.props.live !== undefined` = data nyata, selain itu = data contoh (`/demo`).
3. **Data asli menggantikan data contoh** lewat `src/components/v3/live/useLive.ts` (SWR → bentuk state prototipe) + aksi tulis.
4. Layar v3 di root layout sendiri **tanpa Tailwind preflight**; tools publik lama di route group `(legacy)`.

## Status
| Tahap | Status |
|---|---|
| Generator + logika + `/demo` | selesai |
| Shell, routing (`/`, `/login`, `/setup`, `/app/*`, `/demo/*`), tema/bahasa persisten, login & logout nyata | selesai |
| Beranda, Hari ini, Mingguan (7 hari terakhir), edit/hapus/tambah transaksi, sinkron | selesai (data nyata) |
| Budget (advisor), Pemasukan (+sumber, forecast, perlu dicek), Check-in, Target tabungan (+simulasi), Langganan | selesai (data nyata) |
| Laporan (Minggu/Bulan/6 bln/Semua, CSV, gambar), Analisis, Tanya Track (+kartu), Yang Track ingat, Rapikan kategori | selesai (data nyata) |
| Split bill (daftar, buat, bagi item, lunas, tautan `/s/slug`), Setting (Gmail, Telegram, sinkron, backfill, log, saldo, alias), Sumber data (status per bank + log), Privasi (ekspor CSV) | selesai (data nyata) |
| Kalkulator | selesai (hitungan lokal seperti prototipe) |
| Landing, Masuk | selesai (Masuk memakai login nyata) |
| Daftar, Masuk Google, Lupa password, Wizard setup, Harga/Plus, alamat penerus | tampilan saja (sesuai keputusan) |

## Verifikasi
- DOM + geometri + computed style dibandingkan ke `Trackster v3 App (standalone).html` untuk 17 layar (dark, desktop 1280): identik kecuali tiga selisih sengaja di bawah.
- Alur nyata diuji terhadap backend lokal (DB sementara terpisah): login, tambah/edit/hapus transaksi, selesaikan "perlu dicek", setor ke target, kirim chat (jalur error AI), bahasa EN, tema terang, mobile.

## Selisih yang disengaja dari prototipe
- Field "Email" di Masuk menerima **username** (backend login pakai `username`).
- Label total di tengah donat Analisis **tampil** (di prototipe berupa `<span>` di dalam `<text>` SVG sehingga tidak terender).
- Chip "N aktif" (Langganan) memakai spasi normal (di prototipe spasi hilang akibat pembungkus runtime).
- Angka/teks contoh yang tertulis langsung di markup (mis. burn rate, total pemasukan minggu ini) diganti data asli; di `/demo` tetap teks asli prototipe.
- "Hapus akun" (Privasi) belum ada di backend: setelah konfirmasi hanya menampilkan toast, data tidak diubah.
- Fitur lama yang tidak ada di desain v3 tidak punya UI lagi (backend tetap): patungan/reimbursement, toggle rollover budget, health score, daftar transaksi lengkap berhalaman (`/app/transactions`).
- Landing sekarang dirender di client (teks tidak ada di HTML awal; metadata/OG tetap).

## Cara memperbarui
- Desain berubah: ganti `Trackster v3 App.dc.html`, jalankan `node scripts/dc-to-tsx.mjs` (dari `apps/frontend`), cek `git diff` pada `views/`. Teks contoh baru di markup → tambahkan ke tabel `LITERALS` di generator + kunci `*Txt` di `rv_live()` (`logic.tsx`).
- Data/aksi baru: `live/useLive.ts` + cabang `live` di `logic.tsx`.
