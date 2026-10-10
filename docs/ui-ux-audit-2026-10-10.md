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
  kelas hover/active): `v3-ph` (hanya ponsel < 720px), `v3-nph` (sembunyi di ponsel), `v3-wrap`, `v3-minw0`, `v3-col`, `v3-tight`.
- Pola baris daftar di ponsel: chip status diduplikasi di kolom info (`v3-ph`), yang di kolom sendiri `v3-nph`.
- Field form minimal 16px; chip tinggi tetap wajib `white-space:nowrap`.
