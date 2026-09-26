# Trackster Revamp v2 — Index

> Dibuat 2026-09-24 dari 10 permintaan Arzaka + audit langsung ke kode, DB production, dan inbox Gmail.
> Folder ini adalah **sumber kebenaran** buat semua sesi pengerjaan revamp. Update status di sini tiap sesi selesai.

## Cara pakai (baca ini dulu tiap sesi baru)

Tiap sesi Claude Code **cuma perlu baca 4 hal** (biar context nggak bloated):

1. `CLAUDE.md` + `docs/context/*` (otomatis lewat hook)
2. File ini (`docs/revamp/README.md`) — cek status & sesi berikutnya
3. [`02-conventions.md`](02-conventions.md) — aturan lintas-epic (WAJIB)
4. **Satu** file epic yang lagi dikerjain (`epics/Exx-*.md`)

Baca [`01-findings.md`](01-findings.md) cuma kalau epic-nya nge-refer ke sana. Jangan baca semua epic.

### Prompt pembuka sesi (copy-paste)

```
Kerjain sesi <Exx-Sy> dari docs/revamp. Baca docs/revamp/README.md, docs/revamp/02-conventions.md,
dan docs/revamp/epics/<file epic>.md dulu. Kerjakan HANYA scope sesi itu. Sebelum selesai: jalanin
checklist verifikasi di 02-conventions.md, centang task di file epic, update tabel status di README,
dan catat keputusan baru di docs/context/Decisions.md. Jangan push ke main sebelum aku bilang oke.
```

## Peta permintaan → epic

| # | Permintaan Arzaka | Epic |
|---|---|---|
| 1 | VA ke GoPay nggak kecatat | [E01 Parser Fix](epics/E01-parser-fixes.md) |
| 2 | Pemasukan otomatis? (riset) | [E02 Income Auto-Capture](epics/E02-income-auto-capture.md) + [riset](research/income-notifications.md) |
| 3 | AI jadi personal advisor, RAG lebih baik, simulasi | [E04 AI Advisor Core](epics/E04-ai-advisor.md) |
| 4 | Model pemasukan (ngajar, magang, mingguan, tak tentu) | [E03 Income Model](epics/E03-income-model.md) |
| 5 | Fitur publik lebih bagus & lebih banyak | [E08 Public Tools](epics/E08-public-tools.md) |
| 6 | Analisis minim, 30d = all time | [E06 Analytics](epics/E06-analytics.md) |
| 7 | Laporan kurang maksimal (minggu/bulan/6 bulan/all) | [E07 Reports](epics/E07-reports.md) |
| 8 | Tanya Track: chat nggak disave, nggak masuk RAG | [E04 AI Advisor Core](epics/E04-ai-advisor.md) |
| 9 | Saran budget harian berbasis pemasukan + AI | [E05 Budget Advisor](epics/E05-budget-advisor.md) |
| 10 | Mascot blob simpel, HIGHLY animated, terasa buddy | [E09 Mascot](epics/E09-mascot.md) |
| — | Fondasi: timezone, kategori, log parser (prasyarat semua) | [E00 Foundation](epics/E00-foundation.md) |

## Status

Legend: ⬜ belum · 🟨 jalan · ✅ selesai (sudah diverifikasi di browser & di-push)

| Sesi | Judul | Fase | Butuh | Status |
|---|---|---|---|---|
| E00-S1 | Helper waktu WIB + ganti semua boundary hari/minggu/bulan | 0 | — | ✅ |
| E00-S2 | Log hasil parse email (EmailParseLog) + halaman riwayat sync | 0 | — | 🟨 (kode selesai & diverifikasi endpoint; backfill nyata nunggu sync jalan di prod) |
| E00-S3 | Kategori konsisten: merchant rule + kategori baru + "Rapikan kategori" | 0 | E00-S1 | 🟨 (kode selesai & diverifikasi endpoint; belum dijalankan di prod) |
| E01-S1 | Parser BCA Virtual Account (GoPay top-up & VA lain) | 0 | — (E00-S2 disarankan) | ✅ |
| E01-S2 | Parser Flip: buang CSS, skip email instruksi, label baru | 0 | — (E00-S2 disarankan) | ✅ |
| E01-S3 | Aturan saldo vs baseline + perbaikan data + backfill | 0 | E01-S1, E01-S2 | ✅ |
| E03-S1 | Data model IncomeStream + seed 5 sumber pemasukan | 1 | E00-S1 | ✅ |
| E03-S2 | Forecast pemasukan (konservatif/ekspektasi/maks) + halaman Pemasukan v2 | 1 | E03-S1 | ✅ |
| E03-S3 | Weekly check-in (web + Telegram tombol) → catat income aktual | 1 | E03-S2 | ✅ (halaman `/app/income/checkin` diverifikasi di browser prod; kirim Telegram nyata masih belum dites — perlu tunggu cron beneran jalan) |
| E03-S4 | Alokasi 50/30/20 mingguan (overwrite DailyBudget dari check-in + rekomendasi tabungan Telegram) — di luar 10 permintaan awal, ad-hoc request Arzaka | 1 | E03-S3 | ✅ (kode & halaman `/app/budget` diverifikasi di browser prod; alokasi otomatis dari cron Minggu 21:00 belum kejadian nyata — `DailyBudget` masih nilai lama, sesuai ekspektasi karena belum lewat Minggu pertama sejak deploy) |
| E02-S1 | Parser Jago "menerima uang" + deteksi transfer internal | 1 | E03-S1, E00-S2 | 🟨 (kode selesai: parser+klasifikasi+balance-only+UI+notif, `npm run build`/`tsc --noEmit`/self-check lulus, endpoint diverifikasi via curl di dev server — **browser dev tidak bisa dites** karena browser Arzaka jalan di laptop, bukan VPS, dan sesi ini nggak ada tunnel SSH; backfill 60 hari juga belum jalan, butuh sync Gmail live) |
| E02-S2 | Endpoint ingest + iOS 27 Shortcut notifikasi myBCA (eksperimen) | 1 | E02-S1 | ⬜ |
| E04-S1 | Persistensi chat (thread + message) + history ke model | 2 | — | ⬜ |
| E04-S2 | Financial snapshot + memory jangka panjang + halaman "Yang Track ingat" | 2 | E04-S1, E03-S2 | ⬜ |
| E04-S3 | Retrieval (Postgres FTS) atas chat lama, catatan, laporan | 2 | E04-S2 | ⬜ |
| E04-S4 | Tools advisor baru + engine simulasi + kartu di chat | 2 | E04-S2 | ⬜ |
| E04-S5 | Persona konsultan + mode cepat + Telegram pakai memory yang sama | 2 | E04-S4 | ⬜ |
| E06-S1 | PeriodStats service (range + pembanding) — dipakai Analisis & Laporan | 3 | E00-S1, E00-S3 | ⬜ |
| E06-S2 | Halaman Analisis v2 (kebiasaan, heatmap, anomali, rutin vs besar) | 3 | E06-S1 | ⬜ |
| E07-S1 | Laporan Mingguan & Bulanan v2 + snapshot tersimpan | 3 | E06-S1 | ⬜ |
| E07-S2 | Laporan 6 Bulan & All-time + export/share | 3 | E07-S1 | ⬜ |
| E05-S1 | Saran budget harian (3 opsi) + analisis kepatuhan | 3 | E03-S2, E06-S1 | ⬜ |
| E05-S2 | Penjelasan AI + terapkan + check-in budget mingguan | 3 | E05-S1, E04-S4 | ⬜ |
| E09-S1 | Engine blob prosedural + mata + emosi | 4 | — (paralel kapan saja) | ⬜ |
| E09-S2 | Interaksi (tap, drag, lirik kursor, tidur) + reaksi event app | 4 | E09-S1 | ⬜ |
| E09-S3 | Pasang di seluruh app (chat, dashboard, empty/loading state) | 4 | E09-S2 | ⬜ |
| E08-S1 | Split Bill v2: pajak proporsional, item patungan, diskon, share WA | 4 | — | ⬜ |
| E08-S2 | Kalkulator Tabungan v2 (instrumen, inflasi, mingguan, grafik) | 4 | — | ⬜ |
| E08-S3 | Hub /tools + Kalkulator PayLater/Cicilan + OG image | 4 | E08-S2 | ⬜ |
| E08-S4 | Patungan Trip (multi-bill, settle up minimal transfer) | 4 | E08-S1 | ⬜ |

Urutan & alasannya ada di [`00-ROADMAP.md`](00-ROADMAP.md).

## Isi folder

```
docs/revamp/
├── README.md                  ← index + status (file ini)
├── 00-ROADMAP.md              ← fase, dependency, jalur paralel, definisi selesai
├── 01-findings.md             ← hasil audit: bug & fakta data (dengan bukti)
├── 02-conventions.md          ← aturan lintas-epic + checklist verifikasi
├── epics/
│   ├── E00-foundation.md
│   ├── E01-parser-fixes.md
│   ├── E02-income-auto-capture.md
│   ├── E03-income-model.md
│   ├── E04-ai-advisor.md
│   ├── E05-budget-advisor.md
│   ├── E06-analytics.md
│   ├── E07-reports.md
│   ├── E08-public-tools.md
│   └── E09-mascot.md
└── research/
    └── income-notifications.md ← jawaban lengkap permintaan #2
```
