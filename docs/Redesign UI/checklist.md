# Checklist Redesign Trackster Web v2

Sumber: `docs/Redesign UI/README.md`. Aturan: cuma layer UI (markup/className), API/SWR/bisnis nggak boleh diubah. Tiap fungsi halaman lama wajib ketemu di halaman baru.

## Batch & status

| Batch | Scope | Status |
|---|---|---|
| 1 | Token `tailwind.config.js` | ✅ done |
| 2 | Komponen `components/ui/*` + mascot | ✅ done |
| 3 | NavBar + layout shell | ✅ done |
| 4 | Dashboard + Hari ini + Mingguan | ✅ done |
| 5 | Budget + Pemasukan + Check-in | ✅ done |
| 6 | Langganan + Target tabungan | ✅ done |
| 7 | Setting + Tanya Track + Yang Track ingat | ✅ done |
| 8 | Split bill (daftar, wizard, detail, publik) | ✅ done |
| 9 | Laporan | ✅ done |

## Per halaman (fungsi lama → penempatan baru)

**Dashboard** (`app/app/page.tsx`)
- [ ] Hero sisa/terpakai hari ini + badge status + progress + "Lihat detail" → `/app/today`
- [ ] Carousel 2 slide: Net hari ini (surplus/defisit, pemasukan, pengeluaran) & Langganan (burn/bln, aktif, jatuh tempo dekat, Kelola)
- [ ] Menu 7 pintasan grid tile (QUICK_LINKS)

**Hari ini** (`app/app/today/page.tsx`)
- [ ] Hero badge status + budget + sisa/lewat + progress 10px
- [ ] Alert over budget (cuma kalau over)
- [ ] Runway akhir bulan → 1 baris collapsible (burn rate, sisa hari, saldo)
- [ ] Daftar transaksi: avatar inisial, alias, ikon catatan/alias, meta "Sumber · jam · kategori · aiCaption"
- [ ] Klik baris → modal transaksi: kategori (13 + konfirmasi "Semua (n)"/"Ini saja"), ganti nama, catatan ≤500, Hapus (konfirmasi saldo), Batal, Simpan catatan
- [ ] Empty state + footer "Sinkron otomatis dari email BCA dan Jago"
- [ ] Modal catat pengeluaran: nominal, deskripsi, kategori, sumber, tanggal; disabled sampai nominal+deskripsi diisi

**Mingguan** (`app/app/weekly/page.tsx`)
- [ ] Hero total + stat Budget / Sisa|Lewat / Rerata
- [ ] Grafik 7 batang (garis budget putus-putus, merah=over, hijau=hari ini); klik batang buka hari itu
- [ ] "Per hari" accordion (tanggal, progress, spent/budget); transaksi buka modal transaksi sama

**Budget** (`app/app/budget/page.tsx`)
- [ ] Hero total minggu + strip 7 hari
- [ ] "Edit manual" collapsible: 7 input + Simpan (Menyimpan... → ✓ Tersimpan)
- [ ] "Saran minggu ini": 3 kartu radio (Hemat/Seimbang/Longgar), alasan+tip, "Dasar perhitungan" collapsible, Terapkan

**Pemasukan** (`app/app/income/page.tsx`)
- [ ] Hero masuk minggu ini vs perkiraan + chip status per stream + Check-in
- [ ] Banner "Perlu dicek": select stream + Simpan + "Bukan pemasukan (internal)"
- [ ] Card bertab: Riwayat (periode + Tambah manual + grup bulan + ⋯ Edit/Hapus) / Sumber (CRUD) / Perkiraan (segmented + 3 tile + upside)

**Check-in** (`app/app/income/checkin/page.tsx`)
- [ ] Kartu per stream: FIXED (otomatis/✓), SESSION (stepper), DEDUCTION (stepper absen), VARIABLE/IRREGULAR (input nominal)
- [ ] Panel kanan sticky: total live, perkiraan, tercatat, Simpan semua → Tersimpan!

**Langganan** (`app/app/subscriptions/page.tsx`)
- [ ] Hero burn/bln + aktif + Tambah; info reminder Calendar; banner hasil sync
- [ ] Daftar aktif: meta siklus/bank/Calendar ✓/catatan, badge jatuh tempo, ⋯ Edit/Hapus (konfirmasi)
- [ ] Nonaktif collapsible; modal: nama, nominal, siklus, jatuh tempo, reminder; rekening/catatan/aktif collapsible

**Target tabungan** (`app/app/goals/page.tsx`)
- [ ] Hero total terkumpul + Target baru; grid kartu: progress, % badge, terkumpul/sisa/Tercapai, Nabung, Simulasi cepat, ⋯ Arsipkan
- [ ] Modal Nabung/Tarik (segmented + jumlah + catatan); modal simulasi slider 5–50% step 5

**Setting** (`app/app/settings/page.tsx`)
- [ ] Pill tab Koneksi / Sinkronisasi / Saldo bank / Alias merchant + Keluar (konfirmasi)
- [ ] Koneksi: Gmail status+Putuskan/Hubungkan; Telegram status+test+modal konfigurasi+switch
- [ ] Sinkronisasi: countdown, Sync manual (disabled tanpa Gmail), Backfill collapsible, log email dropdown 5 status
- [ ] Saldo: kartu BCA/Jago, modal koreksi (tampilkan selisih), riwayat collapsible
- [ ] Alias: edit inline + hapus

**Tanya Track** (`app/app/chat/page.tsx` + `components/chat/*`)
- [ ] Dua panel: riwayat thread 248px (Chat baru, memory, hapus) + percakapan
- [ ] Welcome + 6 quick prompt (isi input, bukan auto-kirim)
- [ ] Bubble user hijau / assistant netral, `**bold**`, indikator mengetik
- [ ] Kartu Simulation / GoalProposal / BudgetProposal; thread aktif di localStorage

**Yang Track ingat** (`app/app/chat/memory/page.tsx`)
- [ ] Deskripsi + Tambah; list urut importance: kind badge, titik kepentingan, berlaku sampai
- [ ] ⋯ Edit/Arsipkan/Hapus; Diarsipkan collapsible; modal isi/jenis/penting/berlaku sampai

**Split bill** (`app/split-bills/*`, `app/s/[slug]/page.tsx`)
- [ ] Daftar: hero belum dibayar teman + Buat, riwayat status
- [ ] Wizard 3 langkah + progress bar: (1) resto/tanggal/transfer collapsible/peserta chip; (2) scan struk + baris item + assign; (3) diskon/service/pajak/ongkir/pembulatan + preview sticky
- [ ] Detail: grand total + chip fee, Salin link, WhatsApp; tab Per orang / Item & pembagian / Tampilan teman
- [ ] Publik `/s/[slug]`: tetap jalan

**Laporan** (`app/app/reports/page.tsx`)
- [ ] Segmented Minggu/Bulan/6 bln/Semua; navigator periode (berikutnya disabled kalau belum lewat)
- [ ] Bagikan gambar (modal preview ShareCard) + Unduh CSV
- [ ] Hero Net + savings rate + vs periode lalu + kepatuhan budget; narasi clamp 2 baris
- [ ] Grafik tren (klik batang → modal DayDetail → modal transaksi)
- [ ] Panel bertab Kategori / Top merchant / Langganan; tab Semua: cari (debounce 400ms) + kategori + bank

## Catatan token
- `maxWidth.content` 720 → 1040px (layout global)
- `fast` 120 → 150ms, easing `enter` baru
- Tambah `card`, `overlay`, `neutral`, `hover`, `text`, `border`, `focus`, `success`, `warning`, `danger`
- shadow `card` + `overlay`
