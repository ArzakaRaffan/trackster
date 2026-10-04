# Handoff: Trackster v3 App (redesign besar)

Redesign penuh aplikasi web Trackster: landing page, auth, wizard setup, dan seluruh app (Beranda, Transaksi, Rencana, Insight, Menu, Setting, Tanya Track, Split bill, dll). Satu prototipe, satu file sumber.

## Tentang file desain
File di folder ini adalah **referensi desain berbentuk HTML**. Itu prototipe yang menunjukkan tampilan dan perilaku yang dimaksud, bukan kode produksi untuk disalin langsung. Tugasnya: **buat ulang desain ini di codebase target** (React, Vue, Next.js, dll.) memakai pola dan library yang sudah ada di sana. Kalau belum ada environment, pilih framework yang paling cocok lalu implementasikan di situ.

## Fidelity
**High-fidelity.** Warna, tipografi, spacing, copy, animasi, dan interaksi sudah final. Rekreasi pixel-perfect. Data (transaksi, nama, angka) adalah contoh.

## File
- `Trackster v3 App (standalone).html`: satu file, jalan offline. Buka langsung di browser untuk melihat desain.
- `Trackster v3 App.dc.html`: sumber desain (template + logika). Baca ini untuk nilai persis. Butuh `support.js` dan `track-mascot.js` di folder yang sama.
- `track-mascot.js`: web component `<track-mascot>` (maskot Track). Atribut: `mood` (idle | happy | alert | think), `size`, `speaking`, `pointer`, `still`.
- `support.js`: runtime pemuat file `.dc.html`. Bukan bagian desain, jangan diporting.

Cara membaca sumber: bagian atas `.dc.html` adalah markup berstyle inline dengan lubang `{{ nama }}`. Bagian `<script data-dc-script>` di bawah berisi class `Component` dengan semua state, data contoh, dan fungsi `rv_*` yang menghitung nilai tiap layar.

## PROMPT UNTUK CLAUDE CODE (salin utuh)

```
Buat ulang desain Trackster v3 App di codebase ini, 1:1 dengan prototipe HTML di folder ini.

Sumber kebenaran: "Trackster v3 App.dc.html" (dan versi standalone-nya untuk dilihat di browser).
Buka standalone di browser, lalu bandingkan hasil kamu dengan itu di tiap layar.

Aturan:
1. 1:1. Jangan menyederhanakan, menambah, mengurangi, atau "memperbaiki" desain.
   Layout, warna, tipografi, jarak, radius, bayangan, copy (termasuk teks Indonesia dan
   terjemahan EN), urutan elemen, dan animasi harus sama persis dengan prototipe.
2. Ambil semua nilai dari file sumber, jangan menebak. Token warna ada di konstanta DARK dan LIGHT,
   kerapatan di DENSITY, kategori di CAT_L. Copy dan terjemahan ada di template dan di kamus
   v3tr() (ID ke EN).
3. Pakai komponen, routing, state management, dan styling yang sudah ada di codebase.
   Jangan menyalin runtime support.js atau pola {{ }} dari prototipe.
4. Semua interaksi di prototipe wajib berfungsi: lihat bagian "Interaksi" di README ini.
5. Dukung tema gelap dan terang, bahasa ID dan EN, dan prefers-reduced-motion.
6. Data contoh di prototipe cuma placeholder. Sambungkan ke data/API asli, tapi bentuk tampilannya tetap.
7. Kerjakan per layar sesuai urutan di README. Setelah tiap layar, bandingkan dengan prototipe
   (desktop 1280px+ dan mobile 390px) dan perbaiki selisihnya sebelum lanjut.
8. Kalau ada hal yang tidak jelas atau ada konflik dengan codebase, tanya dulu. Jangan memutuskan sendiri.
```

## Konsep produk
Trackster mencatat transaksi otomatis dari email notifikasi bank (BCA, Jago, Flip) yang diteruskan lewat filter Gmail milik pengguna. Fokus utama: **sisa uang hari ini** dan pengeluaran/pemasukan otomatis. Tidak ada tombol "+" untuk catat: input manual hanya lewat tombol teks "Tambah manual" di halaman Transaksi.

## Layar
Urutan implementasi yang disarankan:

1. **Landing** (`pre:'landing'`). Header sticky: logo + maskot, Fitur, Harga (disembunyikan di mobile), tombol bahasa ID/EN, tombol tema, Masuk, Coba gratis. Hero dua kolom: badge "Tanpa catat manual", H1 "Jajan tenang. Sisanya urusan Trackster.", paragraf, dua CTA, kartu struk interaktif. Lalu enam baris fitur zig-zag, daftar "Yang kamu dapat di Plus", harga (toggle Bulanan/Tahunan), FAQ accordion, CTA penutup, maskot pendamping.
2. **Auth** (`pre:'auth'`): Masuk, Daftar, Lupa password.
3. **Wizard setup** (`pre:'wizard'`): nama panggilan, pilih bank, alamat penerus, filter Gmail, tes email, budget harian, notifikasi, pasang ke layar utama. Bisa dilanjut di perangkat lain.
4. **Beranda** (`dash`): hero sisa hari ini, carousel ringkasan, runway, kartu coach 3 langkah.
5. **Transaksi** (`today`, `weekly`): daftar per hari, klik baris untuk edit (alias, kategori, catatan, hapus).
6. **Rencana** (`budget`, `income`, `checkin`, `goals`, `subs`): budget advisor 3 opsi, pemasukan + forecast, check-in mingguan, target tabungan, langganan.
7. **Insight** (`reports`, `analysis`, `chat`, `memory`): laporan, analisis (donat, heatmap, anomali), Tanya Track (chat AI dengan kartu simulasi/budget/goal), yang Track ingat.
8. **Menu** (`me`): daftar semua fitur lain, dikelompokkan. Termasuk Split bill, Kalkulator, Sumber data, Privasi, Rapikan kategori, Setting, Pasang ke layar utama.

Navigasi: desktop = sidebar yang bisa dilebarkan/diciutkan. Mobile = bar bawah 5 tab: **Beranda, Transaksi, Rencana, Insight, Menu**. Breakpoint ditentukan lebar kontainer (`bp`: `m` mobile, `t` tablet, `d` desktop).

## Interaksi dan perilaku
**Landing**
- Kartu hero: slider budget 100rb–300rb (step 10rb); tombol catat jajan (Kopi 32rb, Makan siang 38rb, Ojek 24rb, Boba 28rb; maks 8) dan "Ulangi". Sisa = budget − (82.500 + jajan). Status: sisa < 0 → "Jebol" (danger, maskot `alert`); sisa < 20% budget → "Hati-hati" (warning, maskot `think`); lainnya "Masih aman" (brand, maskot `happy`). Angka ber-animasi (`tsNum0/1`), bar lebar transisi 400ms.
- Fitur muncul bertahap saat scroll (opacity 0→1, translateY 24→0, 600ms, `cubic-bezier(.2,0,0,1)`), sekali per baris.
- Demo email (fitur 01): tombol "Kirim email BCA contoh" → email muncul → "Trackster membaca…" 1,4 dtk → transaksi muncul. Jalan otomatis sekali saat baris pertama terlihat.
- Chat Track (fitur 05): input bebas + 4 tombol saran. Balasan setelah indikator mengetik 1 dtk. Maksud dideteksi dari kata kunci: budget/jatah/atur ulang → kartu budget (7 batang + Terapkan); boros/kenapa → teks; nabung/liburan/target → kartu goal (+ Buat goal); angka (mis. "450rb", "1,2 juta", "3jt") → kartu simulasi (grafik garis, 3 statistik; selisih target = round(harga / 400.000) minggu; ≥ 8 minggu = "sebaiknya tunda"). Tombol kartu: idle → "Menyimpan…" 600ms → "✓ …".
- Maskot pendamping: muncul setelah hero, teks berganti per bagian (fitur, harga, faq, cta); gelembung teks disembunyikan di mobile.
- Harga: toggle Bulanan/Tahunan; harga Plus berubah dengan animasi. Plus: Rp29.000/bln atau Rp249.000/thn (hemat 28%). Harga dan masa uji coba adalah contoh.
- FAQ: accordion satu terbuka, animasi `grid-template-rows` 250ms.

**Global**
- Tombol ID/EN dan tema (gelap/terang) ada di landing, sidebar, dan header app. Pergantian bahasa memudar 240ms (dilewati saat reduced motion).
- Tips Track: popover dari maskot, hilang sendiri 6 detik, bisa ditutup.
- Toast untuk hampir semua aksi. Modal untuk edit transaksi, tambah manual, konfirmasi hapus.
- Tombol utama: hover `--brand-hover`, active `scale(.97)`.
- Reduced motion: semua transisi/animasi jadi 1ms.

## Tweaks (prop pada komponen root)
`mulai` (layar awal), `theme` (`dark` | `light`), `density` (`lega` | `ringkas`), `heroFocus` (`sisa` | `terpakai`), `mascot` (`aktif` | `tenang` | `sembunyi`), `reducedMotion` (boolean).

## State penting
`pre` (null | landing | auth | wizard), `page`, `bp`, `lang` (id | en), `themeOv`, `txs`, `streams`/`incomes`, `manual` (budget 7 hari), `goals`, `subs`, `chat`, `split`, `modal`. Landing: `lpBudget`, `lpAdds`, `lpEmail` (0/1/2), `lpChat`, `lpCard`, `lpSeen`, `lpSec`, `lpAnnual`, `faqOpen`.

## Design tokens
Warna ada sebagai CSS variable; konstanta lengkap di `DARK` dan `LIGHT` pada sumber. Ringkasan:

| Token | Gelap | Terang |
|---|---|---|
| `--page` | #1B1814 | #F2ECDD |
| `--card` | #26221C | #FBF8EE |
| `--neutral` | #342E25 | #E8E0CC |
| `--text` | #EFE8D6 | #2B2924 |
| `--text-subtle` | #ADA48E | #6B6656 |
| `--border` | #4A4336 | #D9D0B8 |
| `--brand` | #1ED760 | #1ED760 |
| `--brand-text` | #4EDD85 | #1B7A3E |
| `--brand-subtle` | #25402C | #D3EBD0 |
| `--on-brand` | #04120A | #04120A |
| `--warning-bold` | #FFA42B | #FFA42B |
| `--danger-bold` | #F3727F | #D2433A |

Kerapatan (`DENSITY`): `lega` → pad 24, stack 28, gap 16, row-h 60, hero-fs 52; `ringkas` → pad 18, stack 20, gap 12, row-h 48, hero-fs 40.
Tipografi: **Bricolage Grotesque** (400–800) untuk teks, **DM Mono** (400/500) untuk angka, label kecil, dan tag huruf kapital (letter-spacing .08–.16em). Angka memakai tabular-nums.
Bentuk: radius 6/8/10px; kartu = `box-shadow: 0 0 0 1.5px var(--border)` (tanpa bayangan lembut); pemisah = garis putus-putus 1.5px `var(--border)`; kartu struk hero memakai tepi bawah bergerigi (CSS `mask`); bar progres bersegmen 24 blok.
Easing standar `cubic-bezier(.2,0,0,1)`; durasi 150–300ms (reveal 600ms). Keyframes: `tsIn`, `tsPop`, `tsGrow`, `tsGrowY`, `tsDraw`, `tsFloat`, `tsNum0/1`.
Target sentuh minimal 44px di mobile.

## Aset
Tidak ada gambar raster. Ikon adalah path SVG inline (stroke 2, round). Maskot Track digambar oleh `track-mascot.js`. Font dari Google Fonts.

## Catatan
- Copy testimoni sengaja tidak ada. Jangan menambah testimoni atau angka sosial palsu.
- Teks EN bergantung pada kamus ID→EN di `v3tr()`; saat porting, pakai sistem i18n codebase dan ambil semua pasangan dari kamus itu.
