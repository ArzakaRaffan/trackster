# Audit UI/UX — 2026-10-10

Cakupan: semua layar v3 (`/demo/*` = markup & logika yang sama dengan `/app/*`), landing, `/login`, `/setup`, dan tools publik lama
(`/tools`, `/split-bills/new`, `/savings-calculator`, `/installment-calculator`, `/trip/new`, `/invite`, `/privacy`, `/terms`).
Lebar diuji: 320, 375 (ponsel), 768 (tablet), 1280 (desktop). Tema gelap dan terang.

## Cara audit
- Skrip di browser per layar: elemen yang melewati tepi viewport (overflow horizontal), teks terpotong, kontras teks (WCAG AA 4.5:1 / 3:1
  untuk teks besar), field form < 16px, tombol tanpa nama aksesibel, ukuran target sentuh.
- Screenshot tiap layar per lebar, scroll sampai bawah.
- Interaksi: modal (buka, Escape, fokus), tab, bottom nav, FAB maskot.

## Temuan & perbaikan

| # | Tingkat | Layar | Masalah | Perbaikan |
|---|---|---|---|---|
| 1 | Kritis | Beranda, Target, Langganan, Kalkulator (ponsel) | Halaman bisa digeser ke samping (lebar dokumen 383–443px di layar 375px). Efek berantai: layar `fixed` (landing, `/login`, `/setup`) ikut melebar, sisi kanan form terpotong, bottom nav bergeser. | Akar masalah per layar diperbaiki (no. 2–7) + jaring pengaman `html,body{overflow-x:clip}`. |
| 2 | Kritis | Langganan (ponsel) | Baris langganan rusak: nama terpotong jadi "Pr", chip jatuh tempo menimpa nama, nominal & tombol ⋯ keluar layar. | Di ponsel chip pindah ke bawah nama, kolom nominal tidak lagi dipaksa 112px. |
| 3 | Kritis | Split bill (ponsel) | Judul tagihan terjepit jadi satu kata per baris, chip status menimpa judul. | Pola sama dengan no. 2. |
| 4 | Tinggi | Semua (angka hero) | Angka besar 52px tetap di ponsel → "Rp1.266.900", "Rp14.450.000", "Rp1.440.000" terpotong/meluap. | `--hero-fs` jadi `clamp(34px, 10.5vw, 52px)` (desktop tetap 52px). |
| 5 | Tinggi | Topbar Hari ini / Mingguan (ponsel) | Breadcrumb "‹ Dashboard" menabrak ikon tema; "Tambah manual" pecah dua baris. | Grup ikon tidak menyusut, breadcrumb pakai ellipsis, "Tambah manual" jadi ikon `+` (ada `aria-label`) di ponsel. |
| 6 | Tinggi | Landing (ponsel) | Tombol "Coba gratis" di navbar terpotong di luar layar. | Wordmark disembunyikan di ponsel, padding tombol dirapatkan. |
| 7 | Tinggi | Kalkulator (ponsel) | Tab "Cicilan dan PayLater" pecah 3 baris, tab terakhir keluar layar. | Tab membungkus ke baris baru, label tidak dipecah. |
| 8 | Tinggi | Setting → Koneksi (ponsel) | Chip "TERHUBUNG" menimpa tombol "Putuskan"; info Telegram terjepit satu kata per baris. | Baris membungkus: tombol turun ke bawah, chip turun di bawah judul bila sempit. |
| 9 | Tinggi | Mode terang (semua layar) | Kontras teks gagal AA: teks abu-abu 3.96–4.39, chip status hijau/oranye/merah 4.23–4.25. | Token terang digelapkan sedikit (`--text-subtle`, `--text-subtlest`, `--success/brand/warning/danger-text`) → semua ≥ 4.6. Sama di `legal.css`. |
| 10 | Sedang | Mode gelap | `--text-subtlest` di atas `--neutral` = 4.08. | `#968D77` → `#A1977F` (4.64). |
| 11 | Sedang | Budget (ponsel) | Strip 7 hari: nilai "250rb" terpotong jadi "250r". | Grid `auto-fit, minmax(64px,1fr)` → 4+3 kolom di ponsel, tetap 7 di desktop. |
| 12 | Sedang | Langganan, Check-in, Setting | Chip tinggi tetap ("4 AKTIF", "Variabel bulanan", "Tak tentu") pecah dua baris, teks keluar dari latar chip. | Semua chip `white-space:nowrap`; header check-in membungkus. |
| 13 | Sedang | Semua form (ponsel) | 66 field v3 + field tools publik ber-font 14–15px → iOS Safari otomatis zoom saat fokus. | Field jadi 16px. |
| 14 | Sedang | Split bill baru, Tanya Track (ponsel) | FAB maskot menutupi tombol utama ("Lanjut") dan tombol kirim chat — padding bawah 120px tidak cukup melewati FAB (96–152px dari bawah). | Padding bawah ponsel 168px; FAB disembunyikan di layar chat (sudah di chat AI). |
| 15 | Sedang | Beranda (ponsel) | Popup tips maskot terbuka otomatis 6 detik menutupi angka "Sisa hari ini". | Buka otomatis hanya di layar ≥ 720px; di ponsel lewat FAB. |
| 16 | Sedang | Pemasukan, Split detail, Privasi (ponsel/320px) | Chip status menekan deskripsi; tab Riwayat/Sumber/Perkiraan (3×108px) dan filter log meluap di 320–375px. | Chip pindah ke bawah deskripsi; lebar tab `min(108px, (100vw − 68px)/3)`; filter membungkus; total + status split detail ditumpuk. |
| 17 | Sedang | Semua (ponsel) | Saat load, layout desktop (sidebar) sempat dirender sebelum ResizeObserver jalan (`bp` awal selalu `'d'`). | `bp` awal dihitung dari `window.innerWidth`. |
| 18 | Sedang | Modal (a11y) | Setelah modal ditutup fokus hilang ke `<body>`; halaman di belakang bottom sheet tetap bisa di-scroll di ponsel. | Fokus kembali ke tombol pemicu; scroll latar dikunci selama modal terbuka (ponsel/tablet). |
| 19 | Rendah | Grid kartu (≤ 320px) | `minmax(300px,1fr)` dkk. lebih lebar dari kontainer di layar sangat sempit. | `minmax(min(Npx,100%),1fr)` di 21 grid. |
| 20 | Rendah | Tema terang | Kilatan latar gelap sebelum JS v3 termuat. | Skrip kecil di layout set `data-theme` dari localStorage; `body` ikut warna terang. |

Hasil setelah perbaikan: 0 overflow horizontal di 21 layar pada 320/375/768/1280px; 0 kegagalan kontras di tema gelap & terang
(kecuali tombol nonaktif, dikecualikan WCAG); `tsc --noEmit` dan `next build` lolos.

## Tidak diubah (dengan alasan)
- Titik carousel Beranda (6px): ada tombol ‹ › 32px yang setara, masuk pengecualian WCAG 2.5.8.
- Ikon topbar 38px: di atas minimum WCAG 2.2 (24px), di bawah saran Apple 44px — mengubahnya menggeser seluruh desain.
- Popup tips di desktop tetap terbuka otomatis 6 detik (keputusan desain prototipe).
- Navbar landing di layar < 340px masih sangat rapat (tetap muat di 375px).

## Konvensi baru (untuk perubahan berikutnya)
- Kelas responsif di `src/components/v3/v3.css`, dipakai lewat `class="…"` di `.dc.html` (generator sekarang menggabungkan `class` dengan
  kelas hover/active): `v3-ph` (hanya ponsel < 720px), `v3-nph` (sembunyi di ponsel), `v3-wrap`, `v3-minw0`, `v3-col`, `v3-tight`,
  `v3-g3` (grid jadi `auto 1fr auto` di ponsel).
- Pola baris daftar di ponsel: chip status diduplikasi di kolom info (`v3-ph`), yang di kolom sendiri `v3-nph`.
- Field form minimal 16px; chip tinggi tetap wajib `white-space:nowrap`.

---

# Lanjutan — audit `/app` dengan backend lokal (2026-10-10)

Data: user dari `ADMIN_USERNAME` diisi data ekstrem lewat API (nominal Rp125.000.000, nama merchant/langganan/split/target sangat panjang,
37 transaksi, pemasukan "perlu dicek", langganan jatuh tempo hari ini & besok, target 100%); akun kosong = user baru lewat undangan.
Lebar 320/375/768/1280, gelap & terang. Skrip audit ditambah deteksi **teks terpotong oleh ancestor `overflow:hidden`** (audit /demo
tidak menangkapnya) dan `document.getAnimations().finish()` sebelum mengukur kontras (animasi masuk tertahan = kontras palsu 1.0).

| # | Tingkat | Layar | Masalah | Perbaikan |
|---|---|---|---|---|
| 21 | Tinggi | Loading/error (semua) | Backend mati → layar menampilkan angka bawaan prototipe ("Sisa hari ini Rp200.000 AMAN", "Runway Rp4.049.000", "Belum ada transaksi") tanpa tanda error. | `useLive` ekspos `failed` (data inti error tanpa data); `V3Host` menampilkan "Data belum bisa dimuat" + **Coba lagi**. Loading lama: "Memuat data…" (muncul setelah 600 ms). |
| 22 | Tinggi | Mingguan (ponsel) | Nominal "Per hari" terpotong di tepi kartu (grid tetap 120+180+20px). Rincian hari: judul transaksi terjepit jadi 1–4 huruf. | Di ponsel bar progres disembunyikan, grid `v3-g3`; meta transaksi turun ke baris kedua. |
| 23 | Tinggi | Sumber data | `/app` menampilkan alamat penerus palsu (`kamu-k3j9x@…`, bisa disalin) + chip "Simulasi Flip"; status Terputus menyalahkan alamat penerus padahal Gmail belum terhubung; tombolnya membuka wizard yang cuma tampilan. | Di live keduanya disembunyikan; teks "Gmail belum terhubung…", tombol **Hubungkan Gmail** → Setting. |
| 24 | Tinggi | Hari ini | "Alert Telegram sudah dikirim" selalu tampil walau Telegram belum diatur. | Kalimat hanya muncul kalau Telegram terkonfigurasi. |
| 25 | Sedang | Mingguan | Label batang "136345rb" menimpa batang sebelah. | ≥ 1 jt jadi "1,3jt"/"136jt". |
| 26 | Sedang | Rencana (ponsel) | Tab aktif di strip geser (mis. Langganan) berada di luar layar. | Tab aktif digulir ke tengah strip saat berganti. |
| 27 | Sedang | Tanya Track (ponsel/tablet) | Kolom input di bawah lipatan (tinggi `100vh − 150px` mengabaikan judul + bottom nav). | Non-desktop: `100dvh − 256px`. |
| 28 | Sedang | Pemasukan | Bar progres hero hardcode 48% (tampil terisi walau "Rp0 dari Rp0"). | Lebar = diterima / perkiraan (`/demo` tetap 48%). |
| 29 | Sedang | Analisis | Anomali memakai deskripsi mentah (alias diabaikan) dan nominal tertulis dua kali. | Nama pakai alias (juga di Pembelian besar), nominal hanya di kolom kanan. |
| 30 | Sedang | Akun kosong | Beranda "Isi struk" kosong tanpa teks + tip maskot mengarang kebiasaan ("biasanya jajan jam 3"); Check-in hanya "Rp0 · Simpan semua"; Analisis (Anomali/Kebiasaan/Pembelian besar/donat), Laporan (Kategori) dan Rapikan kosong tanpa teks; bar "rutin" penuh hijau saat Rp0; Langganan "Aktif (0)" di bawah pesan kosong. | Teks keadaan kosong di tiap bagian; tip maskot live netral; Check-in mengarahkan ke tab Sumber (ringkasan disembunyikan); bar netral; judul Langganan di atas. |
| 31 | Rendah | Hari ini (ponsel) | Label "Runway akhir bulan" pecah 3 baris saat nilai besar + chip. | Label & nilai `nowrap`, chip turun ke baris kedua. |
| 32 | Rendah | Setting | Footer "API: https://api.trackster.app" (domain prototipe). | Memakai URL API yang sama dengan tab Shortcut. |
| 33 | Rendah | Laporan | "Masuk Rp0rb · Keluar Rp0rb"; net negatif jadi "Rp-13710rb". | `< 1000` ditulis apa adanya, tanda minus di depan "Rp". |

Hasil: 0 overflow / teks terpotong di 20 layar `/app` pada 320/375/768/1280 (gelap & terang); 0 kegagalan kontras (tab "Minggu" di Laporan
terdeteksi 1.43 = positif palsu: pill hijau elemen terpisah, kontras nyata ≈ 11:1). `/demo` tetap 1:1. `tsc --noEmit` dan `next build` lolos.

### Tidak diubah (perlu keputusan)
- **"Masuk minggu ini" di Pemasukan/Budget hanya menghitung pemasukan yang terkait sumber rutin** (forecast). Pemasukan manual tanpa sumber
  (mis. Rp125 jt minggu ini) tidak terhitung → hero "Rp0", sementara Laporan "Masuk Rp125,0jt". Mengubahnya = keputusan produk/backend.
- Nama langganan sangat panjang di ponsel membungkus sampai 7 baris (tetap terbaca); meta "Calendar belum sync" selalu ter-ellipsis di ponsel.
- Nama transaksi panjang di Hari ini/Beranda tetap 1 baris ber-ellipsis (detail lengkap dengan ketuk).
- "+Rp0 SURPLUS" di Net hari ini akun kosong.
- Strip chip saran di Tanya Track dan carousel Beranda memang scroller horizontal (bukan overflow).
