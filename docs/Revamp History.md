# Revamp History

Arsip ringkas **Revamp v2** (dimulai 2026-09-24, selesai 2026-10-04). Rencana kerja per-epic yang dulu ada di
`docs/revamp/` sudah dihapus karena pekerjaannya selesai dan terverifikasi; dokumen ini menyimpan *apa yang
dikerjakan dan kenapa*, bukan langkah-langkahnya.

## Latar belakang

Audit awal menemukan data belum bisa dipercaya: transaksi Virtual Account tidak ter-parse, email instruksi Flip
tercatat dobel, container berjalan di UTC (transaksi dini hari masuk hari kemarin), sebagian besar transaksi
nyasar ke kategori `LAINNYA`, dan pemasukan berhenti dicatat. Fitur pintar di atas data seperti itu hanya akan
menghasilkan jawaban pintar-tapi-salah, sehingga urutan kerja dibuat **data benar dulu, fitur pintar belakangan**.

## Hasil per epic

| Epic | Cakupan | Hasil utama |
|---|---|---|
| **E00 Foundation** | Waktu, kategori, log parser | Helper waktu WIB dipakai di semua batas hari/minggu/bulan; `EmailParseLog` + halaman riwayat sync; kategori diperluas (Transfer, Top-up, Pendidikan, Perawatan, Investasi, Rokok) + aturan merchant + halaman "Rapikan kategori". |
| **E01 Parser Fix** | BCA VA, Flip, aturan saldo | Parser VA BCA (GoPay/OVO/ShopeePay) dengan guard false-positive e-wallet; parser Flip hanya mencatat *receipt* dan melewati email instruksi; aturan baseline saldo vs backfill; backfill 60 hari dijalankan. |
| **E02 Income Auto-Capture** | Pemasukan otomatis | Parser Jago "menerima uang" + klasifikasi (konfirmasi / internal / perlu dicek); transfer internal menggerakkan saldo tanpa jadi expense (`balanceOnly`); endpoint ingest `POST /income/quick` untuk Shortcut iOS. |
| **E03 Income Model** | Model pemasukan | `IncomeStream` (fixed, per-sesi, variabel, potongan, tak tentu); forecast konservatif/ekspektasi/maksimum; check-in mingguan via web dan Telegram; alokasi 50/30/20 mingguan yang menimpa `DailyBudget` tiap Minggu malam. |
| **E04 AI Advisor** | Tanya Track | Thread + pesan tersimpan; snapshot keuangan deterministik; memory jangka panjang + halaman "Yang Track ingat"; retrieval Postgres FTS (`indonesian`) atas chat, catatan, laporan; engine simulasi + tool advisor + kartu di chat; persona konsultan; streaming SSE; Telegram memakai jalur yang sama. |
| **E05 Budget Advisor** | Saran budget harian | Tiga opsi saran budget dari pemasukan + analisis kepatuhan; penjelasan AI, tombol terapkan, dan check-in mingguan; rollover sisa budget harian (opsional, default mati, berantai dalam minggu Senin–Minggu, tanpa utang negatif). |
| **E06 Analytics** | Analisis | `AnalyticsService.getPeriodStats()` sebagai satu-satunya sumber statistik periode (rentang bebas + periode pembanding); pembelian besar dipisah dari pengeluaran rutin; anomali, kebiasaan, heatmap waktu; drill-down ke `/app/transactions`. |
| **E07 Reports** | Laporan | Laporan mingguan & bulanan dengan snapshot tersimpan (periode tutup dibekukan, narasi AI idempoten); laporan 6 bulan & all-time; export/share. |
| **E08 Public Tools** | Fitur publik | Split Bill v2 (pajak proporsional, item patungan, diskon, share WA); kalkulator tabungan v2; hub `/tools` + kalkulator cicilan/PayLater; Patungan Trip dengan settle-up transfer minimal. |
| **E09 Mascot** | Karakter "Track" | Engine blob prosedural dengan mata dan emosi; interaksi (tap, drag, lirik kursor, tidur); dipasang di chat, dashboard, empty state, dan loading. |

Di luar rencana awal (permintaan ad-hoc selama revamp): patungan/talangan (reimbursement) dengan pengeluaran
efektif net, daily recap + anomaly watchdog Telegram, minggu Senin→Minggu yang konsisten di seluruh app, rapikan
room chat, dan pemindahan build image ke GitHub Actions + GHCR.

## Keputusan desain yang bertahan

- **Angka selalu dari kode deterministik; LLM hanya memilih dan menjelaskan.** Tidak ada angka tampilan yang
  dihitung model.
- **Saldo live incremental**, tidak pernah dihitung ulang dari agregat; hanya bergerak lewat `adjustBalance()` di
  dalam Prisma transaction yang sama dengan operasi utamanya.
- **Satu service statistik** untuk Analisis, Laporan, budget, dan AI supaya angka tidak pernah berbeda antar halaman.
- **"RAG" = snapshot + memory terstruktur + Postgres FTS**, bukan vector search: untuk satu pengguna, konteks yang
  penting kecil dan selalu relevan, sehingga disuntik langsung ke prompt.
- **Satu definisi minggu** (Senin–Minggu, WIB) di semua tempat; model data `DailyBudget` tidak diubah, hanya urutan
  tampilnya.
- **Fitur publik terisolasi** dari `Transaction`/`BankBalance`.
- **Kolom baru yang dipakai untuk matching/join wajib di-backfill di migration yang sama**, bukan lewat skrip terpisah.

## Pelajaran proses

- "Kode ada di `main`" bukan berarti "sudah diverifikasi": verifikasi di browser sungguhan menemukan bug nyata yang
  lolos compile (state thread chat tidak bertahan setelah refresh).
- Eval dengan model AI asli menemukan bug yang tidak terlihat di tes deterministik (model menebak tahun saat
  mengisi `validUntil` memory).
- Host produksi berspesifikasi kecil: build berat dipindah ke CI dan dev-testing lokal tidak boleh dijalankan
  berbarengan dengan proses deploy.

Catatan keputusan rinci dan jebakan teknis dari masa revamp dicatat di log keputusan (ADR) dan catatan gotcha
internal proyek.
