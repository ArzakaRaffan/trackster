# Rencana implementasi — Trackster v3 (1:1 dari `Trackster v3 App.dc.html`)

Branch kerja: `feat/v3-redesign`. Push ke `main` **sekali di akhir**, setelah semua layar selesai, `npm run build` + `tsc --noEmit` lolos, dan diverifikasi di browser (CD main = auto-deploy prod).

## Keputusan (dari Arzaka)
- Layar pra-app (Daftar, Masuk Google, Lupa password, Wizard setup, Harga/Plus): **visual 1:1, tanpa backend baru**. Tombolnya memberi toast / lanjut ke alur yang sudah ada. Produk tetap single-user.
- `docs/Redesign UI/*` yang terhapus di working tree: jangan disentuh.

## Pendekatan (kenapa 1:1 terjamin)
1. **Markup digenerate, bukan ditulis ulang.** `apps/frontend/scripts/dc-to-tsx.mjs` mem-parse template `.dc.html` (baris 43–1280) dan menghasilkan satu komponen React per layar di `src/components/v3/views/*View.tsx`, plus `V3Tree.tsx` (kerangka shell) dan `pseudo.css` (aturan hover/active/focus dari atribut `style-*`). Semua nilai (warna, jarak, copy ID, bentuk) datang langsung dari sumber.
2. **Logika prototipe dibawa utuh.** Blok `<script data-dc-script>` (class `Component`: state, `rv_*`, kamus `v3tr()` ID→EN, animasi, modal, form) diekstrak ke `src/components/v3/logic.tsx` (`V3Logic extends React.Component`). Interaksi, validasi, dan copy persis prototipe.
3. **Data asli menggantikan data contoh** per slice (lihat tabel). Tampilan tetap; hanya sumber data dan aksi yang diganti.

## Tahap
| # | Tahap | Status |
|---|---|---|
| 1 | Generator + logika + `/v3-preview` (prototipe jalan 1:1 di Next, data contoh) | selesai |
| 2 | Shell & routing: `page` ↔ URL (`/app`, `/app/today`, …), tema/bahasa persisten, font, login nyata | |
| 3 | Beranda + Transaksi (hari ini, mingguan, edit/hapus/tambah manual) | |
| 4 | Rencana: budget, pemasukan, check-in, target tabungan, langganan | |
| 5 | Insight: laporan, analisis, Tanya Track, memory, rapikan kategori | |
| 6 | Menu: sumber data, privasi, setting (Gmail/Telegram/saldo/alias), split bill, kalkulator | |
| 7 | Landing publik di `/` + Auth (Masuk nyata; Daftar/Google/Lupa/Wizard/Harga visual saja) | |
| 8 | Verifikasi tiap layar vs standalone (1280px & 390px, gelap & terang, ID & EN), build, hapus kode lama yang tak terpakai, update vault, push | |

## Pemetaan data (prototipe → backend yang ada)
Diisi saat mengerjakan tiap tahap.

## Penyimpangan yang sudah diketahui dari prototipe
- Field "Email" di Masuk menerima username apa pun (backend login pakai `username`, bukan email).
