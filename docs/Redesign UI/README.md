# Handoff: Trackster Web redesign (desktop-first)

## Overview
Redesign seluruh UI aplikasi web Trackster (`apps/frontend`, Next.js 14 + Tailwind). Tujuannya: tampilan compact, bersih, dan modern. Yang paling penting tampil di depan, sedangkan detail disembunyikan lewat tab, dropdown, carousel, collapsible, menu ⋯, dan modal. **Semua fungsionalitas yang ada sekarang wajib tetap ada**, karena yang berubah hanya layer UI.

Halaman yang dicakup: Dashboard, Hari ini, Mingguan, Budget, Pemasukan, Check-in, Langganan, Target tabungan, Setting, Tanya Track, Yang Track ingat, Split bill (daftar, wizard, detail, tampilan teman), dan Laporan.
Belum dicakup: Analisis, Rapikan kategori, Landing, Login, Kalkulator tabungan, dan `/split-bills/manage/[token]`. Halaman manage ini isinya sama dengan detail, jadi pakai layout detail.

## About the design files
File di folder ini adalah **referensi desain dalam HTML**, yaitu prototipe yang menunjukkan tampilan dan perilaku yang diinginkan. File ini **bukan kode produksi untuk disalin**. Tugasnya adalah **membangun ulang desain ini di codebase `trackster` yang sudah ada** (React/Next.js + Tailwind, SWR, `motion/react`, lucide-react) dengan pola dan komponen yang sudah dipakai di repo.

- `Trackster Web v2 (standalone).html`: buka langsung di browser, bisa offline. Semua halaman bisa diklik lewat sidebar.
- `Trackster Web v2.dc.html` + `support.js`: sumber prototipe. Logika data contoh ada di class `Component`. Method `batch2`–`batch6` berisi per halaman.
- `screen-map.md`: peta layar → file repo.

Data di prototipe adalah contoh. Di aplikasi asli, tetap pakai endpoint API dan SWR yang sudah ada.

## Fidelity
**High-fidelity.** Warna, tipografi, spasi, radius, dan interaksi sudah final. Buat ulang sedekat mungkin pakai Tailwind. Tambahkan token baru di `tailwind.config.js` bila belum ada.

## Aturan kerja untuk agent
1. Jangan ubah API call, SWR key, tipe data, atau logika bisnis. Ganti markup dan className saja, plus pindahkan elemen ke tab, modal, atau collapsible.
2. Urutan kerja: token di `tailwind.config.js` → komponen `components/ui/*` → halaman sesuai Screen map. Kerjakan satu batch per PR.
3. Setiap fungsi di halaman lama harus bisa ditemukan di halaman baru. Buat checklist per halaman (lihat bagian Screens).
4. Hormati `prefers-reduced-motion` (sudah ada `useReducedMotion` di repo).

## Layout global
- **Shell desktop:** sidebar kiri sticky 228px (logo, 6 menu utama, grup "Lainnya" yang bisa dibuka-tutup, status sinkron di bawah) + konten `max-width:1040px` di tengah. Padding konten `16px 96px 112px 8px`. Padding kanan 96px supaya tidak tertutup FAB Track.
- **Top bar per halaman:** kiri berisi breadcrumb/kembali (bila ada). Kanan berisi tombol Sinkron (ikon, berputar saat loading), Notifikasi (dropdown 320px, titik oranye), dan tombol primer "Catat pengeluaran" yang membuka modal dari halaman mana pun.
- **Header:** judul 32/40 bold, letter-spacing −0.02em, lalu subjudul 15px `text-subtle`.
- **Hero angka:** label 14/600 subtle, angka `--hero-fs` (52px lega / 40px ringkas) weight 700, letter-spacing −0.035em, `tabular-nums`.
- **Kartu:** `bg card`, radius 16px, padding `--pad` (24px), shadow `shadow-card`. Jarak antar-kartu `--gap` (16px), antar-section `--stack` (28px).
- **Baris list:** min-height `--row-h` (60px), radius 12px, hover `bg hover`. Aksi sekunder dipindah ke menu ⋯ (dropdown 150px).
- **Modal:** max 480px, radius 20px, padding 22/24, blanket `rgba(0,0,0,.6)`. Masuk dengan animasi `translateY(12px) scale(.98) → 0`, 240ms. Esc dan klik blanket menutup modal.
- **Toast:** pill di bawah tengah, background `text` dan warna teks `page` (inverse), 44px, hilang otomatis dalam 3 detik.
- **Widget Track:** FAB 56px di kanan bawah. Popover tips 296px dengan strip atas 4px (oranye = pengingat, hijau = tips). Muncul otomatis saat ada tips baru, hilang sendiri dalam 10 detik. Tombol × = dismiss. Badge oranye muncul kalau ada pengingat yang belum dilihat. Tombol "Tanya lebih lanjut" menuju chat.

## Screens (fungsi yang wajib ada → penempatan baru)
**Dashboard.** Hero sisa atau terpakai hari ini + badge status + progress + "Lihat detail" (ke Hari ini). Carousel 2 slide: Net hari ini (surplus/defisit, pemasukan, pengeluaran) dan Langganan (burn/bln, jumlah aktif, jatuh tempo dekat, Kelola). Menu 7 pintasan dalam grid tile.

**Hari ini.** Hero dengan badge status, budget, dan sisa/lewat, lalu progress 10px. Alert over budget muncul hanya kalau over. Runway akhir bulan menjadi 1 baris collapsible (burn rate, sisa hari, saldo). Daftar transaksi: avatar inisial, judul alias, ikon catatan/alias, dan meta "Sumber · jam · kategori · aiCaption". Klik baris membuka **modal transaksi**: kategori (select 13 kategori; kalau merchant yang sama >1, konfirmasi "Semua (n)" / "Ini saja"), ganti nama + Simpan, catatan (maks 500 karakter), Hapus (konfirmasi saldo), Batal, Simpan catatan. Empty state, footer "Sinkron otomatis dari email BCA dan Jago". **Modal catat pengeluaran:** nominal, deskripsi, kategori, sumber, tanggal. Tombol disabled sampai nominal dan deskripsi diisi.

**Mingguan.** Hero total + stat Budget/Sisa|Lewat/Rerata. Grafik 7 batang (garis budget putus-putus, merah = over, hijau = hari ini); klik batang membuka hari itu. "Per hari" menjadi accordion (tanggal, progress, spent/budget). Transaksi di dalamnya membuka modal transaksi yang sama.

**Budget.** Hero total minggu + strip 7 hari. "Edit manual" collapsible berisi 7 input + Simpan (Menyimpan... → ✓ Tersimpan). "Saran minggu ini" berisi 3 kartu radio (Hemat/Seimbang/Longgar: label, deskripsi, badge "Saran Track", total/minggu, mini bar 7 hari, tabungan, realismFlag), kotak alasan + tip, "Dasar perhitungan" collapsible, dan tombol Terapkan (Menerapkan... → ✓ Diterapkan!).

**Pemasukan.** Hero masuk minggu ini vs perkiraan + chip status per stream + tombol Check-in. Banner "Perlu dicek" (select stream + Simpan + "Bukan pemasukan (internal)"). Card bertab:
- **Riwayat:** dropdown periode Minggu/Bulan/Semua, "Tambah manual", grup per bulan dengan jumlah, menu ⋯ Edit/Hapus.
- **Sumber:** kind badge, nonaktif, ringkasan, menu ⋯ Edit/Hapus. Modal sumber berisi field kondisional per kind; kata kunci dan switch Aktif ada di "Pengaturan lanjutan".
- **Perkiraan:** segmented Minggu ini / ~4 minggu, 3 tile (konservatif/ekspektasi/maks), penjelasan, dan upside irregular.

**Check-in.** Kartu per stream: FIXED (otomatis / ✓ sudah tercatat), SESSION (stepper sesi + offline), DEDUCTION (stepper absen), VARIABLE/IRREGULAR (input nominal). Panel kanan sticky: total live, perkiraan, tercatat, Simpan semua → Tersimpan! + Lihat pemasukan / Ubah lagi.

**Langganan.** Hero burn/bln + jumlah aktif + Tambah. Info reminder Calendar. Banner hasil sync. Daftar aktif: meta siklus/bank/Calendar ✓/catatan, badge jatuh tempo (merah = hari H atau lewat, oranye = ≤ reminder), menu ⋯ Edit/Hapus (konfirmasi). Nonaktif collapsible. Modal: nama, nominal, siklus, jatuh tempo, reminder; rekening, catatan, dan aktif dibuka-tutup. Tombol "Tambah & sync Calendar".

**Target tabungan.** Hero total terkumpul + Target baru. Grid kartu: progress, % badge, terkumpul/sisa/Tercapai, Nabung, Simulasi cepat, menu ⋯ Arsipkan. Modal Nabung/Tarik (segmented + jumlah + catatan). Modal simulasi: slider 5–50% langkah 5, hasil "Tercapai n bulan lebih cepat" dan estimasi sekarang vs dipotong.

**Setting.** Pill tab Koneksi/Sinkronisasi/Saldo bank/Alias merchant + Keluar (konfirmasi).
- **Koneksi:** Gmail (status, Putuskan/Hubungkan). Telegram (status, Kirim test, modal konfigurasi, switch notifikasi tiap transaksi).
- **Sinkronisasi:** countdown sync otomatis, Sync manual (disabled tanpa Gmail), Backfill collapsible, log email dengan dropdown 5 status dan link ke Gmail.
- **Saldo:** kartu BCA/Jago, modal koreksi yang menampilkan selisih, riwayat collapsible.
- **Alias:** edit inline dan hapus.

**Tanya Track.** Dua panel: riwayat thread 248px (Chat baru, tombol memory, hapus thread) dan panel percakapan. Welcome + 6 quick prompt yang mengisi input (tidak auto-kirim). Bubble user hijau, bubble assistant netral, `**bold**` tetap dirender. Indikator mengetik. Kartu: Simulation (line chart saldo vs tanpa beli, 3 stat, asumsi collapsible), GoalProposal (Buat goal), BudgetProposal (7 hari + Terapkan). Thread aktif tetap disimpan di localStorage.

**Yang Track ingat.** Deskripsi + Tambah. List diurutkan dari importance tertinggi: kind badge, titik kepentingan, "Berlaku sampai". Menu ⋯ Edit/Arsipkan/Hapus. Diarsipkan collapsible (Pulihkan/Hapus permanen). Modal: isi, jenis (7), penting (1–3), berlaku sampai.

**Split bill.**
- **Daftar:** hero belum dibayar teman + Buat, riwayat dengan status.
- **Wizard 3 langkah** dengan progress bar:
  1. Resto, tanggal, info transfer collapsible (terisi dari localStorage), dan peserta sebagai chip (Enter untuk menambah).
  2. Scan struk (khusus owner), baris item (deskripsi, harga, qty, line total, hapus), chip assign multi. Kosong = dibagi rata. Cek subtotal struk (cocok/lebih/kurang).
  3. Diskon/Service/Pajak (% dan Rp), pajak setelah service, ongkir, pembulatan (0/100/500/1000), dan preview per orang sticky. Lanjut disabled sesuai `canGoStep`. Non-owner → halaman manage.
- **Detail:** grand total + chip fee, Salin link, Kirim ke WhatsApp. Tab Per orang (Lunas/Belum), Item & pembagian (toggle assign), dan Tampilan teman (preview `/s/[slug]`).

**Laporan.** Segmented Minggu/Bulan/6 bln/Semua. Navigator periode (berikutnya disabled untuk periode yang belum lewat). Bagikan gambar (modal preview ShareCard → toPng/share) dan Unduh CSV. Hero Net + savings rate + perbandingan vs periode lalu + kepatuhan budget. Narasi "Ringkasan dari Track" clamp 2 baris, atau catatan "periode masih berjalan". Grafik tren (klik batang harian → modal DayDetail → modal transaksi). Panel bertab Kategori (dengan bar periode sebelumnya) / Top merchant / Langganan, atau Per bulan / Rekor & milestone. Tab Semua: cari (debounce 400ms) + kategori + bank dengan hasil yang bisa diedit.

## Interactions & motion
- Durasi: fast 150ms (hover, press, warna), base 200–250ms (tab indicator, collapsible, dropdown), slow 320–400ms (progress, bar chart, carousel, modal).
- Easing: `cubic-bezier(.2,0,0,1)` untuk masuk/gerak, `cubic-bezier(.16,1,.3,1)` untuk float maskot.
- Masuk halaman: `opacity 0 → 1, translateY(6px) → 0`, 250ms.
- Collapsible: animasi `grid-template-rows: 0fr ↔ 1fr` + chevron rotate 180°.
- Indikator tab/segmented: pill/garis yang digeser dengan `transform: translateX`.
- Tombol primer saat press: `scale(.97)`.
- Semua tombol: focus-visible outline 2px `--focus`, offset 2px. Target klik minimal 34–44px.
- Scrollbar: tipis 10px, thumb membulat `--border-bold`, track transparan.

## Design tokens
**Font:** Figtree 400/500/600/700 (Google Fonts), `font-variant-numeric: tabular-nums` global. Skala: 32/40 (h1), 22–24 (angka sekunder), 20/28, 17 (h2), 16, 15/22 (body), 14/20, 13/18, 12.

**Warna gelap (default):**
- page #121212, card #181818, card-hover #1F1F1F, overlay #272727
- neutral #232323, neutral-hover #2C2C2C, hover rgba(255,255,255,.07)
- text #FFFFFF, text-subtle #B3B3B3, text-subtlest #8C8C8C
- border rgba(255,255,255,.08), border-bold #5A5A5A, focus #FFFFFF
- brand #1ED760, brand-hover #3BE477, on-brand #04120A, brand-subtle rgba(30,215,96,.12)
- success #1ED760 (subtle .12), warning #FFA42B (subtle rgba(255,164,43,.13)), danger #F3727F (subtle rgba(243,114,127,.13))
- shadow-card `0 0 0 1px rgba(255,255,255,.04)`, shadow-overlay `0 16px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06)`

**Warna terang:**
- page #F5F5F4, card #FFFFFF, card-hover #FAFAF9, overlay #FFFFFF
- neutral #F0F0EF, neutral-hover #E7E7E5, hover rgba(0,0,0,.045)
- text #121212, text-subtle #5B5B5B, text-subtlest #767676
- border rgba(0,0,0,.08), border-bold #A3A3A3, focus #121212
- brand #1ED760 (hover #1AC455), brand-text #10803A
- success-text #10803A, warning-text #9A5A00, danger-text #C0303F, danger-bold #E5475A
- shadow-card `0 1px 2px rgba(0,0,0,.05), 0 0 0 1px rgba(0,0,0,.05)`

**Kategori (chart):** MAKANAN #fb7185, TRANSPORT #2dd4bf, BELANJA #c084fc, TAGIHAN #fbbf24, HIBURAN #f472b6, KESEHATAN #22d3ee, TRANSFER #818cf8, TOPUP #38bdf8, PENDIDIKAN #facc15, PERAWATAN #f9a8d4, INVESTASI #4ade80, ROKOK #a8a29e, LAINNYA #94a3b8. Ini sama dengan `CATEGORY_COLORS` di repo.

**Radius:** 6 (badge/kind), 8–10 (input, menu item), 12 (baris, kartu kecil), 14–16 (kartu), 18–20 (modal, popover), 999 (pill: tombol, chip, segmented, toast).

**Kepadatan:**
- Lega: pad 24, stack 28, gap 16, row 60, hero 52
- Ringkas: pad 18, stack 20, gap 12, row 48, hero 40

**Tombol:**
- Primer: pill, brand/on-brand, 38–46px, 700
- Sekunder: neutral/text, 600
- Ghost: transparan, text-subtle, hover `bg hover`
- Destruktif: teks danger, hover danger-subtle
- Disabled: neutral + text-subtlest (pakai `aria-disabled`, tetap bisa difokus)

## Assets
- Logo: tile #1ED760 radius 9 dengan huruf "T" #04120A. Pakai `/trackster-logo.svg` yang ada di repo.
- Maskot Track: `TracksterMascot.tsx` versi flat. Body #1ED760 (alert #FFA42B), tanpa radial gradient dan glow, mata/mulut #121212, float 3.6s + kedip 4.5s. Mati saat reduced motion.
- Ikon: lucide-react. Path SVG di prototipe diambil dari lucide.

## State (tambahan UI saja)
Tab aktif per halaman, open/close collapsible, menu ⋯ (`rowMenu`), modal aktif, index carousel, draft form di modal, dan toast. Semua data tetap dari SWR/endpoint yang sudah ada.

## Files
- `Trackster Web v2 (standalone).html`: prototipe yang bisa diklik, offline
- `Trackster Web v2.dc.html`, `support.js`: sumber prototipe
- `screen-map.md`: peta layar ↔ file repo
