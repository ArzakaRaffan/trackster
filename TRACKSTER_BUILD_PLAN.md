# Trackster — Build Plan

## 1. Project Summary

Trackster adalah personal finance expense tracker yang otomatis mencatat pengeluaran dari notifikasi email bank/e-wallet (BCA, Jago, GoPay), menghitung total pengeluaran harian, dan mengirim alert via Telegram bot ketika budget harian terlampaui.

**Target user:** Single user (Arzaka) — mahasiswa yang magang dan menerima beberapa sumber pemasukan, ingin mengontrol pengeluaran harian agar tidak boros.

**Problem yang diselesaikan:** Tracker keuangan yang ada sekarang mengharuskan input manual setiap transaksi. Trackster mengotomatisasi pencatatan pengeluaran lewat parsing email notifikasi transaksi, sehingga user hanya perlu set budget dan terima alert.

**Success criteria:**
- Pengeluaran dari BCA, Jago, dan GoPay otomatis tercatat tanpa input manual
- User bisa set budget harian per hari dalam seminggu (Senin-Minggu)
- Sistem mengirim notifikasi Telegram ketika pengeluaran hari ini melebihi budget
- Dashboard web menampilkan ringkasan pengeluaran harian dan mingguan vs budget
- Dashboard dilindungi autentikasi (single-user, username + password)

---

## 2. Tech Stack

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| Backend | **NestJS** (TypeScript) | User sudah familiar dari project REI Academy |
| Frontend | **Next.js 14+** (TypeScript, App Router) | User sudah familiar, SSR/SSG support |
| Database | **PostgreSQL 16** | Relational, cocok untuk data transaksi terstruktur |
| ORM | **Prisma** | User sudah familiar dari REI Academy dan UIWIB |
| Container | **Docker + Docker Compose** | Sudah terinstall di VPS |
| Reverse Proxy | **Nginx** | SSL termination, routing subdomain |
| SSL | **Certbot (Let's Encrypt)** | Gratis, auto-renewal |
| Email | **Gmail API** (OAuth2) | User pakai Gmail untuk notifikasi bank |
| Notifikasi | **Telegram Bot API** | Gratis, instant, no app store approval |
| Auth | **JWT** (cookie-based, httpOnly) | Single-user, simple dan secure |
| Styling | **Tailwind CSS** | Cepat, utility-first |

**Key libraries:**
- `@nestjs/schedule` — cron job polling email
- `googleapis` — Gmail API client
- `node-telegram-bot-api` — Telegram bot
- `@prisma/client` — database ORM
- `bcrypt` — password hashing
- `@nestjs/jwt` + `@nestjs/passport` — auth
- `recharts` — chart di dashboard

---

## 3. Architecture Overview

```
┌──────────────┐     email notif      ┌──────────────┐
│  BCA / Jago  │ ──────────────────>  │    Gmail     │
│   / GoPay    │                      │   Inbox      │
└──────────────┘                      └──────┬───────┘
                                             │
                                    Gmail API (OAuth2)
                                    Cron setiap 5 menit
                                             │
                                      ┌──────▼───────┐
                                      │   NestJS     │
                                      │   Backend    │
                                      │              │
                                      │ - Email Poll │
                                      │ - Parser     │
                                      │ - Budget     │
                                      │ - Alert      │
                                      │ - REST API   │
                                      └──────┬───────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              │              │
                       ┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼──────┐
                       │ PostgreSQL  │ │  Next.js   │ │  Telegram  │
                       │  Database   │ │ Dashboard  │ │    Bot     │
                       └─────────────┘ └───────────┘ └────────────┘

Domain routing (Nginx):
  trackster.my.id        → Next.js (port 3000)
  api.trackster.my.id    → NestJS  (port 4000)
```

**Data flow — pengeluaran tercatat:**
1. User bayar sesuatu pakai BCA/Jago/GoPay
2. Bank/e-wallet kirim notifikasi transaksi ke Gmail user
3. NestJS cron job (tiap 5 menit) polling Gmail API, filter email dari sender bank
4. Email Parser Service extract: nominal, merchant/deskripsi, timestamp, sumber (BCA/Jago/GoPay)
5. Transaksi disimpan ke PostgreSQL (tabel `transactions`)
6. Budget Engine cek: total pengeluaran hari ini vs budget hari ini
7. Kalau melebihi budget → kirim alert via Telegram Bot
8. Dashboard Next.js menampilkan data real-time dari REST API

---

## 4. Features & Scope

### Core (MVP)
1. **Gmail OAuth Connect** — user menghubungkan akun Gmail untuk dibaca notifikasi transaksinya
2. **Email Polling** — cron job tiap 5 menit, fetch email baru dari sender bank/e-wallet
3. **Email Parser** — regex parser untuk 3 sumber: BCA, Jago, GoPay (extract nominal, deskripsi, timestamp)
4. **Transaction Log** — semua pengeluaran tersimpan di database, bisa dilihat di dashboard
5. **Daily Budget Setting** — set budget per hari (Senin s/d Minggu), disimpan di database
6. **Budget Check + Telegram Alert** — setiap transaksi baru masuk, cek apakah total hari ini > budget → kirim Telegram notif
7. **Dashboard** — halaman utama: pengeluaran hari ini vs budget, daftar transaksi hari ini, ringkasan mingguan
8. **Single-user Auth** — login dengan username + password (JWT httpOnly cookie)

### Nice-to-have (setelah MVP)
- Kategori otomatis (makan, transport, hiburan) via keyword matching dari deskripsi transaksi
- Grafik tren mingguan/bulanan (line chart, bar chart)
- Export data ke CSV
- Budget rollover (sisa budget hari ini ditambahkan ke besok)
- Multiple Telegram chat target (misal kirim ke group juga)
- Manual add transaction (untuk cash/tunai yang nggak lewat email)

### Out of scope
- Integrasi API bank langsung (tidak feasible untuk personal)
- Tracking pemasukan otomatis (fokus pengeluaran dulu)
- Multi-user / multi-tenant
- Mobile app native
- Integrasi langsung ke API e-wallet (GoPay SDK dll)

---

## 5. Data Models

### User
```
id          Int       @id @default(autoincrement())
username    String    @unique
password    String    (bcrypt hashed)
createdAt   DateTime  @default(now())
```

### Transaction
```
id          Int       @id @default(autoincrement())
amount      Decimal   (dalam Rupiah, positif = pengeluaran)
description String    (merchant/deskripsi dari email)
source      String    (BCA | JAGO | GOPAY)
emailId     String    @unique (Gmail message ID, untuk deduplikasi)
occurredAt  DateTime  (waktu transaksi dari email)
createdAt   DateTime  @default(now())
```

### DailyBudget
```
id          Int       @id @default(autoincrement())
dayOfWeek   Int       (0=Minggu, 1=Senin, ..., 6=Sabtu)
amount      Decimal   (budget dalam Rupiah)
updatedAt   DateTime  @updatedAt
```
Catatan: selalu ada 7 row (satu per hari), di-seed saat setup awal.

### EmailSyncLog
```
id          Int       @id @default(autoincrement())
lastSyncAt  DateTime  (timestamp email terakhir yang diproses)
status      String    (SUCCESS | ERROR)
message     String?   (error message jika gagal)
createdAt   DateTime  @default(now())
```

### TelegramConfig
```
id          Int       @id @default(autoincrement())
botToken    String    (token dari @BotFather)
chatId      String    (chat ID user)
isActive    Boolean   @default(true)
updatedAt   DateTime  @updatedAt
```

---

## 6. API Endpoints

### Auth
- `POST /auth/login` — login, return JWT di httpOnly cookie
- `POST /auth/logout` — clear cookie
- `GET  /auth/me` — cek user saat ini

### Transactions
- `GET  /transactions` — list transaksi (query params: date, startDate, endDate, source, page, limit)
- `GET  /transactions/today` — transaksi hari ini + total
- `GET  /transactions/weekly` — ringkasan minggu ini (per hari)
- `DELETE /transactions/:id` — hapus transaksi (kalau salah parse)

### Budget
- `GET  /budget` — ambil semua 7 daily budget
- `PUT  /budget` — update semua 7 daily budget sekaligus (body: array of {dayOfWeek, amount})
- `GET  /budget/today` — budget hari ini + sisa budget

### Gmail
- `GET  /gmail/auth-url` — generate OAuth2 URL untuk connect Gmail
- `GET  /gmail/callback` — OAuth2 callback, simpan refresh token
- `GET  /gmail/status` — cek apakah Gmail sudah terkoneksi
- `POST /gmail/disconnect` — hapus refresh token

### Telegram
- `GET  /telegram/status` — cek konfigurasi Telegram
- `PUT  /telegram/config` — set/update bot token dan chat ID
- `POST /telegram/test` — kirim pesan test ke Telegram

### Sync
- `POST /sync/trigger` — manual trigger email sync (untuk testing)
- `GET  /sync/logs` — list sync log terakhir

---

## 7. Email Parser Specifications

### PENTING — Konteks alur uang user (WAJIB dibaca sebelum implementasi parser)

User punya 2 rekening yang saling terhubung:
- **BCA** = rekening utama (terima gaji/pemasukan, dipakai untuk pengeluaran besar/di luar budget mingguan)
- **Jago** = rekening khusus weekly expense (uang jajan harian weekday), diisi dengan transfer mingguan dari BCA via Flip

**GoPay TIDAK di-track** (keputusan user — topup GoPay selalu dari BCA jadi sudah captured di sana).

**Masalah double-counting yang HARUS di-handle:**
1. Transfer BCA → Jago (via Flip) bukan pengeluaran, itu perpindahan uang antar kantong sendiri. Harus di-exclude dari expense.
2. Sebaliknya, kalau ada transfer Jago → BCA (atau ke rekening lain milik user sendiri), itu juga bukan pengeluaran, harus di-exclude.

**Aturan exclusion untuk parser Jago:**
```
Kalau field "Ke" pada email Jago mengandung nama user sendiri ("ARZAKA RAFFAN MAWARDI")
  → SKIP, jangan simpan sebagai transaction (ini self-transfer/internal)
Kalau field "Ke" adalah nama orang lain atau merchant
  → SIMPAN sebagai expense
```

**Aturan exclusion untuk parser BCA (transfer ke Jago via Flip) — CONFIRMED:**
```
Kalau field "Beneficiary Name" mengandung "FLIPTECH" (contoh nilai asli: "FLIPTECH LENTERA IP PT")
  → SKIP, jangan simpan sebagai transaction (ini transfer top-up ke Jago via Flip, internal)
Kalau "Beneficiary Name"/"Payment to" adalah pihak lain
  → SIMPAN sebagai expense
```
Catatan implementasi: field ini muncul di email BCA jenis "Transfer to BCA Account" (Transfer Type), bukan "QRIS Payment". Parser BCA perlu menangani minimal 2 sub-format:
1. QRIS Payment → field `Payment to` sebagai description
2. Transfer to BCA Account → field `Beneficiary Name` sebagai description, dan field ini yang dicek untuk exclusion "FLIPTECH"

---

### Format Email BCA (CONFIRMED dari contoh asli user)

**Sender:** BCA (nama tampilan "BCA", terverifikasi/blue check)
**Subject:** kemungkinan berisi info transaksi (perlu dikonfirmasi exact subject line dari header asli, contoh yang ada baru body-nya)

**Body format (QRIS Payment):**
```
Hello [NAMA],

You just made a transaction through myBCA.
Here are the details of your transaction :

Status              : Successful
Transaction Date    : [DD Mon YYYY HH:MM:SS]
Transaction Type    : QRIS Payment
Payment to           : [Merchant Name]
Merchant Location   : [Lokasi]
Acquirer             : [GOPAY/dll]
Merchant PAN         : [angka]
Terminal ID           : [kode]
Source of Fund        : TAHAPAN - [4 digit]****[2 digit]
Customer PAN           : [angka]
Total Payment          : IDR [nominal].00
RRN                    : [angka]
Reference No.           : [kode panjang]
```

**Field mapping untuk parser (QRIS Payment):**
- `amount` ← `Total Payment` (format: "IDR 3,330.00" — parse angka, strip "IDR" dan koma ribuan)
- `description` ← `Payment to` (contoh: "Exabytes")
- `occurredAt` ← `Transaction Date` (format: "10 Aug 2026 14:13:15")
- `transactionType` ← `Transaction Type` (contoh: "QRIS Payment")

**Catatan:** email ini formatnya sangat terstruktur dengan label jelas (key: value), jadi parser bisa pakai pendekatan line-by-line split by ":" daripada regex kompleks — lebih robust terhadap perubahan minor format.

---

### Format Email BCA — Transfer to BCA Account (CONFIRMED dari contoh asli user)

Format ini muncul saat transfer ke rekening BCA lain (termasuk transfer mingguan ke Jago via Flip).

**Body format:**
```
Hi [NAMA],

You just made a transaction through myBCA.
Here are the details of your transaction :

Status              : Successful
Transaction Date    : [DD Mon YYYY HH:MM:SS]
Transfer Type       : Transfer to BCA Account
Source of Fund      : [rekening tersamar, contoh: 6611xxxx89]
Source Currency     : IDR - Indonesian Rupiah
Beneficiary Account : [nomor rekening tujuan]
Transfer Currency   : IDR - Indonesian Rupiah
Beneficiary Name    : [NAMA PENERIMA]
Transfer Amount     : IDR [nominal].00
Remarks             : [catatan, bisa kosong/"-"]
Reference No.       : [kode UUID panjang]
```

**Field mapping untuk parser:**
- `amount` ← `Transfer Amount` (format: "IDR 187,325.00")
- `description` ← `Beneficiary Name` (contoh: "FLIPTECH LENTERA IP PT")
- `occurredAt` ← `Transaction Date`
- `transactionType` ← `Transfer Type` (contoh: "Transfer to BCA Account")
- **Exclusion check:** kalau `Beneficiary Name` mengandung "FLIPTECH" → skip (top-up mingguan ke Jago via Flip, internal transfer)

**Cara membedakan sub-format BCA untuk routing ke field mapping yang tepat:**
```
Kalau body mengandung "Transaction Type" dan nilainya "QRIS Payment"
  → gunakan mapping QRIS (description dari "Payment to")
Kalau body mengandung "Transfer Type" dan nilainya "Transfer to BCA Account"
  → gunakan mapping Transfer (description dari "Beneficiary Name", cek exclusion "FLIPTECH")
```
Parser BCA sebaiknya dirancang sebagai satu parser dengan logic pembeda di atas (bukan generic key-value extractor yang sama untuk semua label), karena label field-nya berbeda antar sub-jenis transaksi (`Transaction Type` vs `Transfer Type`, `Payment to` vs `Beneficiary Name`, `Total Payment` vs `Transfer Amount`).

---

### Format Email Jago (CONFIRMED dari 2 contoh asli user)

**Sender:** Jago (nama tampilan "Jago")
**Subject:** "Kamu telah melakukan transfer" (untuk transaksi jenis transfer — kemungkinan ada subject lain untuk QRIS/pembayaran, belum ada contoh)

**Body format:**
```
Halo [NAMA],

Terima kasih sudah bertransaksi dengan Jago! Kamu baru saja melakukan
transfer uang, berikut rinciannya:

Ringkasan transaksi

Dari              [Inisial] · [nomor rekening sumber]
Ke                [NAMA PENERIMA]
                  [Bank] · [nomor rekening tujuan]
Jumlah            Rp[nominal]
Tanggal transaksi [DD Month YYYY] [HH:MM] WIB
```

**Field mapping untuk parser:**
- `amount` ← `Jumlah` (format: "Rp10.000" — parse angka, strip "Rp" dan titik ribuan)
- `description` ← `Ke` (nama penerima, baris pertama setelah label "Ke")
- `destinationBank` ← baris kedua setelah "Ke" (contoh: "BCA" atau "Jago")
- `occurredAt` ← `Tanggal transaksi`
- **Exclusion check:** kalau `description` (nama penerima) match dengan nama user sendiri → skip (self-transfer)

**PENTING:** kedua contoh transfer di atas adalah jenis "transfer". Untuk pembayaran QRIS/merchant, formatnya BERBEDA — lihat sub-bagian di bawah.

---

### Format Email Jago — QRIS/Pembayaran Merchant (CONFIRMED dari contoh asli user)

**Subject:** "Kamu telah membayar ke [Nama Merchant]"

**Body format:**
```
Halo [NAMA],

Terima kasih sudah bertransaksi dengan Jago! Kamu baru saja mengirimkan uang,
berikut rinciannya:

Ringkasan transaksi

Dari              [nomor rekening sumber]
Ke                [NAMA MERCHANT]
                  [ID merchant]
Jumlah            Rp [nominal]
Tanggal Transaksi [DD Month YYYY, HH:MM] WIB
Status Transaksi  Berhasil
Nama Acquirer     [Provider QRIS, contoh: "Pakai Donk"]
Lokasi Merchant   [Kota/Kabupaten]
ID Terminal       [kode alfanumerik]
PAN Nasabah       [angka]
Jumlah Tip        Rp [nominal, biasanya 0]
```

**Field mapping untuk parser:**
- `amount` ← `Jumlah` (format: "Rp 6.392" — perhatikan ada spasi setelah "Rp", beda dari format transfer yang tanpa spasi "Rp10.000")
- `description` ← `Ke` (nama merchant, baris pertama)
- `occurredAt` ← `Tanggal Transaksi` (perhatikan: label ini "Tanggal Transaksi", beda dari transfer yang "Tanggal transaksi" — case-sensitive, parser perlu case-insensitive match)
- `transactionType` ← "QRIS" (bisa diinfer dari kehadiran field `Nama Acquirer`)
- **Tidak perlu exclusion check** — pembayaran ke merchant selalu dihitung sebagai expense (beda dari transfer yang perlu dicek nama penerima)

**Cara membedakan subject transfer vs QRIS untuk routing ke parser yang tepat:**
```
Subject mengandung "melakukan transfer"  → gunakan Transfer Parser (cek exclusion self-transfer)
Subject mengandung "membayar ke"         → gunakan QRIS/Merchant Parser (langsung expense, no exclusion)
```

---

### GoPay
**TIDAK PERLU di-parse** — sesuai keputusan user, GoPay dikeluarkan dari scope karena topup-nya selalu dari BCA (sudah tercatat di sana). Modul parser tetap disiapkan sebagai stub/interface kosong untuk future use, tapi tidak diaktifkan di MVP.

---

### Testing strategy untuk parser
1. Buat fixture files berisi 3 contoh email nyata di atas (anonymized/sanitized nominal & data pribadi jika perlu) di `apps/backend/src/modules/gmail/parsers/__fixtures__/`
2. Unit test masing-masing parser terhadap fixture ini — pastikan field ter-extract dengan benar
3. Unit test khusus untuk exclusion logic (self-transfer Jago, dan nanti transfer-to-Flip di BCA begitu contohnya ada)
4. Sisanya (subject BCA exact, format Jago untuk QRIS, format transfer-ke-Flip di BCA) tetap perlu contoh tambahan dari user — tandai sebagai TODO di kode dengan comment jelas

---

## 8. Implementation Plan

### Step 1: Project Scaffolding & Monorepo Setup
**Goal:** Setup project structure, monorepo dengan apps/backend dan apps/frontend
**Output:** Folder structure, package.json, tsconfig
**Notes:**
```
trackster/
├── apps/
│   ├── backend/          # NestJS
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── transaction/
│   │   │   │   ├── budget/
│   │   │   │   ├── gmail/
│   │   │   │   ├── telegram/
│   │   │   │   └── sync/
│   │   │   ├── common/
│   │   │   │   ├── guards/
│   │   │   │   ├── decorators/
│   │   │   │   └── filters/
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── Dockerfile
│   └── frontend/         # Next.js
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/login/
│       │   │   ├── (dashboard)/
│       │   │   │   ├── page.tsx        # home/today view
│       │   │   │   ├── weekly/
│       │   │   │   ├── transactions/
│       │   │   │   ├── budget/
│       │   │   │   └── settings/
│       │   │   └── layout.tsx
│       │   ├── components/
│       │   ├── lib/
│       │   └── hooks/
│       └── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── .gitignore
└── README.md
```

### Step 2: Docker Compose & Database Setup
**Goal:** docker-compose.yml dengan PostgreSQL + backend + frontend, Prisma schema, migrations
**Output:** docker-compose.yml, schema.prisma, seed script untuk 7 DailyBudget rows
**Notes:**
- PostgreSQL container dengan volume persistent
- Backend container depends_on PostgreSQL
- Frontend container depends_on backend
- Environment variables via .env file
- Seed script insert 7 DailyBudget rows (default semua Rp50.000) dan 1 User (username: admin, password: dari env)

### Step 3: Auth Module
**Goal:** Login/logout, JWT di httpOnly cookie, auth guard
**Output:** auth module, JWT strategy, login/logout/me endpoints
**Notes:**
- Single user, di-seed via seed script
- Password hashed dengan bcrypt
- JWT disimpan di httpOnly secure cookie, bukan localStorage
- AuthGuard untuk protect semua endpoint kecuali /auth/login dan /gmail/callback

### Step 4: Budget Module
**Goal:** CRUD untuk daily budget (7 hari)
**Output:** budget module, endpoints GET/PUT /budget, GET /budget/today
**Notes:**
- Selalu ada 7 row (di-seed), PUT menggantikan value
- GET /budget/today return: budget hari ini, total pengeluaran hari ini, sisa budget
- Response termasuk summary mingguan (total budget vs total pengeluaran minggu ini)

### Step 5: Transaction Module
**Goal:** CRUD transaksi, query by date range, daily/weekly summary
**Output:** transaction module, endpoints sesuai spec
**Notes:**
- Transaksi dibuat otomatis oleh email parser (step 7), bukan manual input
- GET /transactions/today: list transaksi + total pengeluaran hari ini
- GET /transactions/weekly: array 7 hari, masing-masing {date, totalSpent, budget, transactions[]}
- Deduplikasi via emailId (Gmail message ID) — kalau emailId sudah ada, skip

### Step 6: Gmail Integration Module
**Goal:** OAuth2 connect, polling cron job, fetch email baru
**Output:** gmail module, OAuth2 flow, cron service
**Notes:**
- OAuth2 flow: user klik "Connect Gmail" → redirect ke Google consent → callback simpan refresh token
- Refresh token disimpan encrypted di database atau .env (single user, boleh di .env untuk simplicity)
- Cron job (`@Cron('*/5 * * * *')`) — setiap 5 menit
- Query Gmail API: `from:(info@klikbca.com OR no-reply@jago.com OR noreply@gopay.co.id) is:unread` (subject/sender TBD berdasarkan contoh email asli)
- Setelah diproses, mark email as read (opsional) atau simpan lastSyncAt untuk tracking
- PENTING: Gmail API harus dikonfigurasi di Google Cloud Console (enable Gmail API, create OAuth2 credentials, set redirect URI)

### Step 7: Email Parser Service
**Goal:** Parse isi email jadi data transaksi (amount, description, source, timestamp)
**Output:** parser service dengan strategy pattern (satu parser per sumber)
**Notes:**
- Interface: `parseEmail(emailBody: string, sender: string): ParsedTransaction | null`
- BcaParser, JagoParser, GopayParser — masing-masing class terpisah
- Return null kalau email bukan notifikasi transaksi pengeluaran (filter out pemasukan, OTP, promo, dll)
- GUNAKAN MOCK DATA untuk testing sampai contoh email asli tersedia
- Mock data: buat file fixtures/ dengan contoh email untuk setiap parser

### Step 8: Telegram Alert Module
**Goal:** Kirim alert ke Telegram ketika budget harian terlampaui
**Output:** telegram module, bot service, alert trigger
**Notes:**
- User perlu: buat bot via @BotFather, dapatkan token, kirim pesan ke bot, dapatkan chat_id
- Alert dikirim setiap kali transaksi baru masuk DAN total hari ini > budget hari ini
- Format pesan:
  ```
  ⚠️ Budget Harian Terlampaui!

  Hari ini: Rp 85.000 / Rp 50.000
  Kelebihan: Rp 35.000

  Transaksi terakhir:
  GoPay - Rp 25.000 (Grabfood)
  ```
- Jangan spam: kirim alert maksimal 1x per jam (atau cuma kirim saat baru pertama kali melampaui threshold)

### Step 9: Frontend — Login Page
**Goal:** Halaman login sederhana
**Output:** /login page, auth context/provider, middleware redirect
**Notes:**
- Form: username + password
- POST ke /auth/login, simpan JWT di cookie (otomatis dari backend)
- Redirect ke dashboard setelah sukses
- Next.js middleware: redirect ke /login kalau belum auth

### Step 10: Frontend — Dashboard Home (Today View)
**Goal:** Halaman utama — pengeluaran hari ini vs budget
**Output:** / (home) page
**Notes:**
- Card besar: "Pengeluaran Hari Ini: Rp XX.XXX / Rp XX.XXX" dengan progress bar
- Warna hijau kalau masih di bawah budget, merah kalau sudah melampaui
- List transaksi hari ini di bawahnya (tabel sederhana: waktu, sumber, deskripsi, nominal)
- Auto-refresh setiap 1 menit (atau gunakan SWR/React Query dengan refetch interval)

### Step 11: Frontend — Weekly View
**Goal:** Ringkasan pengeluaran mingguan
**Output:** /weekly page
**Notes:**
- Tabel/grid 7 hari: tanggal, budget, total pengeluaran, sisa/kelebihan
- Bar chart sederhana (recharts): budget vs actual per hari
- Highlight hari yang over-budget dengan warna merah

### Step 12: Frontend — Budget Settings
**Goal:** Halaman set budget per hari
**Output:** /budget page
**Notes:**
- Form dengan 7 input field (Senin-Minggu), masing-masing input nominal Rupiah
- Tampilkan total mingguan di bawah (auto-sum)
- Button "Simpan" → PUT /budget
- Feedback: toast/notif sukses/gagal

### Step 13: Frontend — Settings Page (Gmail + Telegram)
**Goal:** Halaman untuk connect Gmail dan konfigurasi Telegram
**Output:** /settings page
**Notes:**
- Section Gmail: tombol "Connect Gmail" / status "Connected" + tombol Disconnect
- Section Telegram: input bot token + chat ID, tombol "Test Kirim Pesan", status active/inactive

### Step 14: Docker Production Setup
**Goal:** docker-compose.prod.yml, Nginx config, SSL
**Output:** production docker compose, nginx.conf, certbot setup
**Notes:**
- Nginx container untuk reverse proxy:
  - trackster.my.id → frontend:3000
  - api.trackster.my.id → backend:4000
- Certbot untuk SSL (Let's Encrypt) — jalankan manual pertama kali, auto-renewal via cron
- Pastikan DNS record untuk api.trackster.my.id sudah di-setup (A record ke IP VPS)

### Step 15: CI/CD via GitHub Actions
**Goal:** Auto deploy ke VPS setiap push ke main branch
**Output:** .github/workflows/deploy.yml
**Notes:**
- Trigger: push to main
- Steps: SSH ke VPS → git pull → docker compose build → docker compose up -d
- Pattern sama dengan yang sudah dipakai di REI Academy (git reset --hard untuk menghindari silent failure)

---

## 9. Environment Variables

```env
# Database
DATABASE_URL=postgresql://trackster:PASSWORD@postgres:5432/trackster

# Auth
JWT_SECRET=random-secret-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=initial-password-change-me

# Gmail OAuth2
GMAIL_CLIENT_ID=from-google-cloud-console
GMAIL_CLIENT_SECRET=from-google-cloud-console
GMAIL_REDIRECT_URI=https://api.trackster.my.id/gmail/callback
GMAIL_REFRESH_TOKEN=obtained-after-oauth-flow

# Telegram
TELEGRAM_BOT_TOKEN=from-botfather
TELEGRAM_CHAT_ID=your-chat-id

# App
BACKEND_PORT=4000
FRONTEND_PORT=3000
NODE_ENV=production
FRONTEND_URL=https://trackster.my.id
BACKEND_URL=https://api.trackster.my.id
```

---

## 10. Prerequisites

### Sudah selesai ✅
1. ~~Enable notifikasi email transaksi BCA~~ — sudah aktif, contoh email sudah didapat (2 sub-format: QRIS Payment & Transfer to BCA Account)
2. ~~Enable notifikasi email transaksi Jago~~ — sudah aktif, 3 contoh email sudah didapat (self-transfer, transfer ke orang lain, QRIS/merchant)
3. ~~Tambah DNS A record untuk `api.trackster.my.id`~~ — sudah ditambahkan, mengarah ke `43.157.208.202`
4. ~~Contoh email BCA transfer ke Jago via Flip~~ — sudah didapat, exclusion rule "FLIPTECH" terkonfirmasi
5. GoPay — tidak perlu di-enable, diluar scope (keputusan user)

### Masih perlu dilakukan sebelum backend gmail module bisa full jalan ⏳
1. **Setup Google Cloud Console project:**
   - Enable Gmail API
   - Create OAuth2 credentials (Web application type)
   - Set authorized redirect URI: `https://api.trackster.my.id/gmail/callback`
   - Catat Client ID dan Client Secret
2. **Buat Telegram bot:**
   - Chat @BotFather di Telegram
   - /newbot → ikuti instruksi → catat bot token
   - Kirim pesan apapun ke bot tersebut
   - Akses `https://api.telegram.org/bot<TOKEN>/getUpdates` → catat chat_id

Catatan: seluruh data format email (5 pattern: BCA QRIS, BCA Transfer+exclusion, Jago self-transfer, Jago transfer-ke-orang-lain, Jago QRIS) sudah lengkap. Development parser tidak lagi bergantung pada mock data — bisa langsung dibangun dari spesifikasi real di atas.

---

## 11. Open Questions

1. **Format email BCA/Jago/GoPay** — belum ada contoh email asli. Parser harus dibangun setelah user mengirimkan contoh email. Sementara gunakan mock data.
2. **Google Cloud Console** — user perlu setup project GCP untuk Gmail API. Perlu kartu kredit? Atau bisa pakai project GCP yang sudah ada (user sudah punya akun GCP dari riset VPS sebelumnya)?
3. **Alert frequency** — apakah alert dikirim setiap kali transaksi baru melampaui budget, atau cukup 1x per hari saat pertama kali terlampaui?

---

## 12. Handoff Prompts

### → Claude Code (Backend)
```
Saya sedang membangun Trackster — personal finance expense tracker yang otomatis mencatat pengeluaran dari email notifikasi bank (BCA, Jago, GoPay) dan mengirim alert Telegram ketika budget harian terlampaui.

Stack: NestJS + Prisma + PostgreSQL
Auth: Single-user, JWT di httpOnly cookie

Baca file TRACKSTER_BUILD_PLAN.md untuk detail lengkap arsitektur, data models, API endpoints, dan implementation steps.

Mulai dari:
1. Scaffold project structure (monorepo: apps/backend)
2. Setup Prisma schema dengan semua models (User, Transaction, DailyBudget, EmailSyncLog, TelegramConfig)
3. Jalankan migration dan seed (7 DailyBudget rows default + 1 admin user)
4. Implementasi auth module (login/logout/me, JWT, AuthGuard)
5. Implementasi budget module (GET/PUT /budget, GET /budget/today)
6. Implementasi transaction module (CRUD, /today, /weekly)
7. Implementasi gmail module (OAuth2 flow, cron polling) — gunakan mock data dulu untuk parser
8. Implementasi email parser service (strategy pattern, BcaParser/JagoParser/GopayParser dengan mock/fixture)
9. Implementasi telegram module (send alert, test endpoint)
10. Buat Dockerfile untuk backend

Key constraints:
- Semua endpoints kecuali /auth/login dan /gmail/callback harus dilindungi AuthGuard
- Transaksi di-deduplikasi via emailId (Gmail message ID)
- Parser menggunakan mock data/fixture sampai contoh email asli tersedia
- Budget: 7 rows fixed (Senin-Minggu), PUT mengganti semua sekaligus
- Alert Telegram: kirim saat transaksi baru masuk DAN total hari ini > budget hari ini
```

### → Claude Code (Frontend)
```
Saya sedang membangun frontend untuk Trackster — dashboard personal finance tracker.

Stack: Next.js 14+ (App Router) + TypeScript + Tailwind CSS
Auth: JWT dari httpOnly cookie, set oleh backend
Backend API: https://api.trackster.my.id (atau localhost:4000 saat development)

Baca file TRACKSTER_BUILD_PLAN.md untuk detail lengkap halaman, komponen, dan API endpoints.

Halaman yang perlu dibuat:
1. /login — form username + password, POST ke /auth/login
2. / (home) — pengeluaran hari ini vs budget (card + progress bar + transaction list)
3. /weekly — ringkasan minggu ini (tabel 7 hari + bar chart)
4. /budget — set budget per hari (7 input field + auto-sum total mingguan)
5. /settings — connect Gmail (OAuth) + konfigurasi Telegram bot
6. Layout dengan sidebar/navbar untuk navigasi antar halaman

Key constraints:
- Next.js middleware: redirect ke /login kalau belum authenticated
- Auto-refresh data setiap 1 menit (SWR atau React Query)
- Warna hijau kalau di bawah budget, merah kalau di atas
- Responsive (mobile-first, karena user sering cek dari HP)
- Recharts untuk chart di weekly view
- Buat Dockerfile untuk frontend
```

### → Claude Code (Infra/DevOps)
```
Setup production deployment untuk Trackster di VPS Ubuntu (Tencent Cloud Lighthouse Jakarta).

VPS specs: 2 vCPU, 2GB RAM, 40GB SSD, Ubuntu 24.04
Docker + Docker Compose sudah terinstall
Domain: trackster.my.id (DNS sudah pointing ke 43.157.208.202)
Subdomain api.trackster.my.id perlu ditambahkan (A record ke IP yang sama)

Buat:
1. docker-compose.prod.yml (PostgreSQL + backend + frontend + nginx)
2. nginx.conf:
   - trackster.my.id → frontend container port 3000
   - api.trackster.my.id → backend container port 4000
3. Certbot setup untuk SSL (Let's Encrypt) kedua domain
4. .github/workflows/deploy.yml — auto deploy on push to main via SSH
5. .env.example dengan semua environment variables yang dibutuhkan

Key constraints:
- VPS cuma 2GB RAM, optimasi memory (jangan build Next.js di VPS, build di GitHub Actions lalu deploy image)
- Gunakan Docker multi-stage build untuk reduce image size
- PostgreSQL data harus persistent (volume mount)
- Pattern CI/CD: SSH → git pull → docker compose build → docker compose up -d (gunakan git reset --hard)
```

---

Ready to hand off to: **Claude Code**
