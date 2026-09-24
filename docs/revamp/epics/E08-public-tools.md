# E08 — Public Tools (Split Bill v2, Kalkulator Tabungan v2, Tools baru)

**Fase 4 (independen, boleh paralel) · 4 sesi · Permintaan #5**

> "Fitur public harus lebih bagus dan diperbanyak supaya kedepannya jika ada sistem subscription dalam
> trackster, orang bisa lebih tertarik. Split bill sebenarnya sudah baik tetapi masih bisa di-improve (cari
> celah), lalu savings calculator sangat sangat basic sehingga tidak menarik untuk orang lain."

## Strategi

Fitur publik = **pintu masuk**. Target orangnya: mahasiswa/first-jobber Indonesia yang makan bareng, patungan,
kepikiran paylater, nabung buat sesuatu. Tiap tool harus:
1. **Berguna penuh tanpa login** (tidak ada "daftar dulu").
2. **Enak dibagikan** — link yang tampil cantik di WhatsApp (OG image), hasil bisa jadi gambar.
3. **Menyelesaikan satu masalah nyata lebih baik dari kalkulator Google/Excel.**
4. Punya **CTA halus** ke Trackster ("Mau dilacak otomatis dari email bank? Segera") — tanpa bikin sistem
   waitlist/akun sekarang (YAGNI sampai ada traksi; ukur dulu dari log nginx berapa yang pakai).

Semua tetap **terisolasi** dari `Transaction`/`BankBalance` (lihat CLAUDE.md). Halaman baru → daftar path publik
di `middleware.ts`.

---

## E08-S1 — Split Bill v2

### Celah yang ditemukan (audit kode)

| # | Celah | Dampak |
|---|---|---|
| 1 | **Bug:** pajak & service dibagi rata per orang (`calculateTotals`: `tax / participantCount`) | Yang pesan es teh bayar pajak sama dengan yang pesan steak — salah secara hitungan |
| 2 | Satu item hanya bisa ke satu orang (`SplitBillItem.participantId`) | Tidak bisa "nasi goreng dibagi 3", "pitcher berdua" |
| 3 | Tidak ada diskon/promo, ongkir, biaya aplikasi | Pesanan GoFood/GrabFood & promo tidak bisa dihitung benar |
| 4 | Pajak/service hanya nominal | Struk biasanya pakai % (PB1 10%, service 5%) |
| 5 | Link manage (`ownerToken`) cuma diberi sekali | Pembuat anonim kehilangan bill-nya kalau lupa simpan link |
| 6 | Tidak ada "kirim ke WhatsApp" per orang | Teman harus buka link & cari namanya sendiri |
| 7 | Link tanpa OG image | Di WA tampil polos, kurang meyakinkan |
| 8 | Tidak ada pembulatan | Tagihan Rp57.273 bikin ribet transfer |

### Desain

- **Pembagian proporsional** (fungsi murni `split-calc.ts` di backend + dipakai frontend untuk preview, atau
  diduplikasi kecil di frontend — pilih satu sumber; default: backend, frontend hanya preview sederhana):
  ```
  subtotal_i   = Σ (harga item × qty × bagian_i)          // bagian dari item patungan (bobot)
  diskon_i     = diskon_total × subtotal_i / Σ subtotal    // diskon % atau nominal
  pajak_i      = (subtotal_i − diskon_i) × pajak%          // atau nominal dibagi proporsional
  service_i    = proporsional sama seperti pajak
  ongkir_i     = ongkir / jumlah_peserta                   // biaya flat dibagi rata
  total_i      = pembulatan(subtotal_i − diskon_i + pajak_i + service_i + ongkir_i)
  selisih pembulatan → ditanggung pembayar (ditampilkan jujur)
  ```
  Urutan pajak vs service mengikuti pilihan (beberapa resto: service dulu lalu pajak dari subtotal+service) → opsi
  "pajak dihitung setelah service". `split-calc.check.ts` wajib (kasus struk nyata).
- **Item patungan:** tabel baru
  ```prisma
  model SplitBillItemShare {
    id            Int @id @default(autoincrement())
    itemId        Int
    item          SplitBillItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
    participantId Int
    participant   SplitBillParticipant @relation(fields: [participantId], references: [id], onDelete: Cascade)
    weight        Decimal @default(1) @db.Decimal(6, 2)
    @@unique([itemId, participantId])
  }
  ```
  Migration menyalin `participantId` lama → satu share bobot 1; kode baca shares saja; kolom lama di-drop di
  migration berikutnya setelah prod aman.
- **Kolom baru `SplitBill`:** `taxPercent`, `servicePercent` (nullable, alternatif nominal), `discountAmount`,
  `discountPercent`, `deliveryFee`, `roundingUnit` (0/100/500/1000), `taxAfterService Boolean`.
- **Riwayat bill di perangkat:** simpan `{slug, ownerToken, restaurantName, date}` di `localStorage` saat create →
  halaman `/split-bills` publik menampilkan "Bill kamu di perangkat ini".
- **Kirim ke WhatsApp:** per peserta `https://wa.me/?text=<encoded>` berisi nama, item-itemnya, total, rekening
  pembayar, link bill. Plus "Salin ringkasan semua" (untuk grup).
- **OG image:** `app/s/[slug]/opengraph-image.tsx` (Next `ImageResponse`): nama tempat, total, jumlah orang, logo.
- **Scan struk:** hasil scan tampil sebagai daftar yang bisa diedit sebelum dipakai; prompt scan juga mengekstrak
  baris diskon, pajak %, service % (update `split-bill-ai.service.ts`).

**Tasks**
- [ ] `split-calc.ts` + check (termasuk kasus: 3 orang, 1 item patungan, pajak 10%, service 5%, diskon 20rb, pembulatan 500)
- [ ] Migration shares + kolom baru + salin data lama
- [ ] Backend service/DTO/endpoint assign multi-peserta (manage via ownerToken & via login)
- [ ] UI create: pajak/service % atau nominal, diskon, ongkir, pembulatan; assign item ke banyak orang (chip multi-select)
- [ ] UI publik: rincian per orang (subtotal, diskon, pajak, service, ongkir), tombol WA per orang, salin semua
- [ ] localStorage riwayat + OG image
- [ ] Verifikasi dengan struk nyata (minta Arzaka foto 1 struk)

## E08-S2 — Kalkulator Target Tabungan v2

Sekarang: rumus linear (target − tabungan) / bulan, preset barang, share card PNG.

**Jadikan "perencana tabungan" yang paling masuk akal untuk pelajar/first-jobber:**
- **Frekuensi**: per minggu *atau* per bulan (pelajar dapat uang mingguan).
- **Dua mode**: "Harus nabung berapa?" (dari deadline) dan "Kapan tercapai?" (dari kemampuan nabung per minggu/bulan).
- **Instrumen** (pilih satu atau bandingkan): Tabungan biasa, Deposito, Reksa dana pasar uang, Emas — return tahunan
  default yang **bisa diedit** dan diberi label "asumsi, bukan jaminan · diperbarui <tanggal>". Jangan klaim angka
  sebagai fakta; sesi yang mengerjakan wajib cek angka terbaru (web search) dan menulis sumbernya di komentar kode.
- **Inflasi harga target** (opsional, default ±3%/tahun, bisa diedit): "iPhone 15jt hari ini ≈ 15,9jt di 2028".
- **Output**:
  - Angka utama: setoran per minggu & per bulan
  - Grafik proyeksi (recharts area: total setoran vs hasil/bunga) + garis target
  - Tabel perbandingan instrumen: "Deposito: tercapai 3 minggu lebih cepat"
  - Relatable: "≈ 1 kopi susu per hari" (angka pembanding bisa diedit)
  - Timeline milestone 25/50/75/100%
- **URL state**: semua input di query params → hasil bisa dibagikan sebagai link. OG image dinamis dari params.
- Share card PNG yang lebih cantik (sudah ada `html-to-image`).
- Self-check `savings-math.check.ts` (bunga majemuk mingguan/bulanan, kasus 0%).

**Tasks**
- [ ] `savings-math.ts` (frontend, fungsi murni) + check
- [ ] UI dua mode + instrumen + inflasi + grafik + tabel perbandingan
- [ ] URL state + OG image + share card
- [ ] Cek angka return instrumen terbaru & catat sumber

## E08-S3 — Hub `/tools` + Kalkulator PayLater/Cicilan + SEO dasar

- `/tools`: grid kartu semua tool publik (Split Bill, Patungan Trip, Target Tabungan, PayLater/Cicilan), satu
  kalimat manfaat tiap tool. Link dari landing page & footer.
- **Kalkulator PayLater/Cicilan** — relevan banget untuk anak muda Indonesia:
  - Input: harga, tenor (bulan), bunga per bulan (flat), biaya admin/layanan per transaksi/bulan, DP.
  - Output: cicilan per bulan, total dibayar, total "biaya tambahan", **bunga efektif per tahun** (IRR via Newton-Raphson
    — flat 2,95%/bln itu jauh di atas 35%/thn efektif), perbandingan "kalau nabung dulu Rp X/minggu → kebeli dalam
    Y minggu, hemat Rp Z", peringatan denda keterlambatan (input opsional).
  - `installment-math.check.ts` (IRR benar untuk kasus tanpa bunga, flat, dengan admin fee).
- SEO: `metadata` per halaman (title, description, openGraph), `app/sitemap.ts`, `app/robots.ts`.

**Tasks**
- [ ] Halaman `/tools` + link dari landing
- [ ] Kalkulator PayLater/Cicilan + check
- [ ] Metadata + sitemap + robots
- [ ] Daftar path publik baru di `middleware.ts`

## E08-S4 — Patungan Trip (group expense ala Splitwise)

Untuk liburan/kos/acara: banyak pengeluaran, banyak pembayar, akhir cukup transfer seminimal mungkin.

- Model baru terpisah (jangan campur dengan SplitBill): `Trip { publicSlug, ownerToken, name, currency }`,
  `TripMember`, `TripExpense { paidByMemberId, amount, description, date }`, `TripExpenseShare { memberId, weight }`.
  Pola `publicSlug` (lihat + tandai lunas) vs `ownerToken` (kelola) sama seperti Split Bill.
- Anggota bisa tambah pengeluaran lewat link publik? → default **tidak** (hanya owner), opsi "izinkan anggota menambah"
  pakai token ketiga kalau diminta. Jangan dibangun dulu.
- **Settle up minimal**: hitung saldo bersih tiap anggota → greedy match terbesar-hutang ke terbesar-piutang
  (maks n−1 transfer). `settle.check.ts`.
- Import Split Bill ke Trip (satu bill = satu expense dengan pembagian per orang) — opsional kalau murah.
- Kirim WA per orang: "Kamu transfer Rp X ke Budi (BCA …)".

**Tasks**
- [ ] Migration + modul `trip`
- [ ] `settle.ts` + check
- [ ] UI create/manage/publik mobile-first + WA share + OG image

## Backlog ide (belum dijadwalkan, jangan dikerjakan tanpa permintaan)

- Kalkulator dana darurat · Cek langganan tahunan ("total langgananmu setahun") · Kalkulator gaji → 50/30/20
- Waitlist/akun untuk versi berbayar Trackster — baru dipikir kalau tool publik sudah dipakai orang (cek log nginx).
