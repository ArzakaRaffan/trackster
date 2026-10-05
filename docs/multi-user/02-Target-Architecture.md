# 02 — Arsitektur Target

Semua bagian bertanda **(PROPOSED)** bergantung pada keputusan di [`00-Decisions.md`](00-Decisions.md). Nama kolom/tabel di bawah adalah
**rancangan** — sesi implementasi boleh menyesuaikan detail (sambil memperbarui dokumen ini), tetapi tidak boleh melanggar prinsip §0.

## 0. Prinsip

1. **Setiap baris data milik tepat satu user.** Tidak ada query tenant tanpa `userId` (kecuali alur publik split-bill/trip yang memang anonim).
2. **Server menentukan userId, bukan klien.** `userId` hanya berasal dari: JWT (request web), `ApiToken` (Shortcut), `InboundAddress` (email),
   `TelegramLink.chatId` (bot), atau iterasi job. **Tidak pernah** dari body/query/parameter yang bisa diubah klien atau dari output LLM.
3. **Default aman:** field `userId` required di Prisma → lupa mengisi saat `create` gagal compile. Skrip audit statis menandai `where` tanpa `userId`.
4. **Backward-compatible per fase** — Arzaka tetap bisa memakai app normal di setiap titik merge.
5. **Minimasi data:** jangan simpan email mentah (P10); jangan log isi email/token.
6. **Satu sumber logika:** parser, saldo, budget tidak diduplikasi untuk multi-user — hanya diberi konteks `userId`/`OwnerContext`.

## 1. Model data (rancangan)

### 1.1 `User` (ubah)

```prisma
enum UserRole   { ADMIN MEMBER }
enum UserStatus { ACTIVE DISABLED }

model User {
  id           Int        @id @default(autoincrement())
  username     String     @unique            // login (case-insensitive: simpan lowercase)
  password     String                         // bcrypt
  role         UserRole   @default(MEMBER)
  status       UserStatus @default(ACTIVE)
  displayName  String?                        // dipakai prompt AI & sapaan (ganti "Arzaka")
  fullName     String?                        // nama di rekening — pengganti OWNER_FULL_NAME
  email        String?    @unique             // kontak (opsional)
  tokenVersion Int        @default(0)         // naikkan = semua JWT lama tidak valid
  createdAt    DateTime   @default(now())
  lastLoginAt  DateTime?
  onboardedAt  DateTime?                      // wizard selesai
  // relasi ke semua tabel tenant...
}
```

`onboarding` detail (langkah wizard, checklist aktivasi) bisa `Json?` atau tabel kecil — lihat [`07-Onboarding-UX.md`](07-Onboarding-UX.md).
User Arzaka (id 1 — verifikasi, P13) → `role=ADMIN`, `fullName`/`displayName` diisi dari `OWNER_FULL_NAME`/"Arzaka" saat backfill.

### 1.2 Tabel baru

| Tabel | Kolom kunci | Catatan |
| --- | --- | --- |
| `Invite` | `id, codeHash (sha256), createdByUserId, forUsernameHint?, expiresAt, usedAt?, usedByUserId?` | Kode acak ≥ 128 bit, **hanya hash disimpan**; sekali pakai; kedaluwarsa 7 hari. Kode ditampilkan sekali oleh CLI. |
| `OneTimeToken` (atau `PasswordResetToken`) | `id, userId, kind (RESET), tokenHash, expiresAt, usedAt?` | Reset password buatan admin (P14). Boleh digabung dengan `Invite` via kolom `kind`. |
| `ApiToken` | `id, userId, label, tokenHash (sha256), prefix (6 char utk tampilan), scopes[] ('INGEST'), createdAt, lastUsedAt?, revokedAt?` | Token plaintext ditampilkan **sekali** saat dibuat. Format: `trk_<base62 32+ char>`. Cari via hash. |
| `InboundAddress` | `id, userId @unique, localPart @unique (acak ≥ 96 bit, base32), gmailSource? (alamat Gmail pengirim-forward), forwardVerifiedAt?, lastEmailAt?, lastForwardCode?, lastForwardCodeAt?, isActive, rotatedAt?` | Alamat lengkap `u-<localPart>@in.trackster.dev` (usulan O8). Rotasi = ganti `localPart` (alamat lama mati). |
| `OwnAccount` | `id, userId, source Source?, label?, accountNumber (digit-only), createdAt` ; `@@unique([userId, accountNumber])` | Pengganti `OWNER_ACCOUNT_NUMBERS`. Nama pemilik di `User.fullName` (+ opsional `aliases String[]`). |
| `TelegramLink` | `id, userId @unique, chatId @unique, linkedAt, isActive, notifyEveryTransaction` ; + `TelegramLinkCode(userId, codeHash, expiresAt)` | Bot bersama (P2). Menggantikan `TelegramConfig`. |
| `AiUsage` | `userId, dayKey (WIB), kind ('CHAT'…), count` ; `@@unique([userId, dayKey, kind])` | Kuota (P9). |

### 1.3 Tabel tenant yang mendapat `userId`

Lihat tabel lengkap + perubahan constraint di [`01-Current-State-Audit.md` §2](01-Current-State-Audit.md). Aturan umum:

- Kolom: `userId Int` + `user User @relation(fields:[userId], references:[id], onDelete: Restrict)` — **Restrict**, bukan Cascade: penghapusan user hanya lewat skrip
  hapus-akun yang eksplisit (urutan hapus terkendali) supaya tidak ada penghapusan beruntun tak sengaja.
- Indeks: `@@index([userId, <kolom query utama>])` — mis. `Transaction [userId, occurredAt]`, `Income [userId, receivedAt]`.
- Unik global → unik komposit `(userId, …)` (daftar di audit).

## 2. Strategi migrasi database (expand → backfill → contract)

Karena `prisma migrate deploy` otomatis di prod saat start, setiap migrasi harus aman dijalankan **di atas data nyata dan oleh kode versi sebelumnya**
(selama window deploy, container lama bisa masih hidup sebentar).

| Langkah | Migrasi | Aman untuk kode lama? |
| --- | --- | --- |
| **E1 Expand** | Tambah tabel baru; tambah `userId Int?` **nullable** di semua tabel tenant (belum ada constraint baru). Kolom User baru bernilai default. | Ya (kolom nullable diabaikan kode lama) |
| **E2 Backfill** | `UPDATE "<tabel>" SET "userId" = <arzakaId> WHERE "userId" IS NULL` untuk **semua** tabel; set `User.role=ADMIN`, isi `fullName`, buat baris `OwnAccount` dari `OWNER_ACCOUNT_NUMBERS`, `TelegramLink` dari `TelegramConfig`. Jalankan sebagai SQL di dalam transaksi; hitung baris sebelum/sesudah. Skrip + verifikasi di [`06-Runbooks.md` §3](06-Runbooks.md). | Ya |
| **E3 Code** | Deploy kode yang **menulis** `userId` di setiap `create` dan **memfilter** setiap query (Fase 2–4). Kode ini memakai kolom nullable tapi selalu mengisinya. | — |
| **C1 Contract** | Setelah verifikasi `COUNT(*) WHERE userId IS NULL = 0` di semua tabel: `SET NOT NULL`, tambah FK, indeks, ganti unique global → komposit, drop unique lama. | **Tidak** untuk kode yang tidak mengisi `userId` → hanya setelah E3 live & stabil |

Catatan teknis:
- Prisma tidak bisa mengekspresikan semua langkah (mis. backfill) → tulis **migrasi SQL manual** (`prisma migrate dev --create-only`, edit SQL). Jangan `db push`.
- `BudgetSetting`: PK saat ini `id=1`. Backfill: baris id=1 → `userId = arzakaId` lalu ubah PK strategi (tetap autoincrement; tambah unik `userId`); hapus semua `findUnique({where:{id:1}})` di kode **sebelum** C1.
- `CategoryIcon`: PK `category` → PK komposit `(userId, category)` → ubah PK = operasi berat-ringan di tabel kecil; tetap pakai transaksi.
- Setelah C1, `schema.prisma` memakai `userId Int` (non-null). `prisma generate` ulang; semua `create` yang lupa `userId` gagal compile — itu **fitur**.
- Ukuran data kecil (single user) → tidak perlu `CONCURRENTLY`, tapi tetap satu migrasi per langkah supaya bisa di-rollback terpisah.
- **Rollback**: E1/E2 reversible (drop kolom/tabel baru; data lama tak berubah). C1 **tidak** otomatis reversible → wajib backup + restore-drill ([`06-Runbooks.md`](06-Runbooks.md)) sebelum C1.

## 3. Auth & sesi

```
Browser ──cookie trackster_jwt──▶ JwtAuthGuard ──▶ @CurrentUser() { id, role }
                                       │
                                       └─ cek: user ada, status=ACTIVE, payload.tv === user.tokenVersion
                                          (cache in-memory 30–60 dtk per user id agar hemat DB)
```

- JWT payload: `{ sub, username, tv }` (tambah `tv` = tokenVersion). Bentuk cookie **tidak berubah**.
- `@CurrentUser()` decorator (`common/decorators/current-user.decorator.ts`) mengembalikan `{ id, role, username }`; menggantikan `(req as any).user.sub` di split-bill/trip.
- `RolesGuard`/`@Roles('ADMIN')` untuk endpoint admin (jika ada). Dengan P4, endpoint admin minimal; CLI menangani pembuatan user.
- Endpoint baru: `POST /auth/register` (kode undangan + username + password), `POST /auth/change-password` (login), `POST /auth/reset-password` (token sekali pakai),
  `POST /auth/logout-all` (naikkan `tokenVersion`).
- Rate limit: throttler **bernama terpisah** (`auth`: mis. 10 percobaan/menit/IP dan 5/menit/username). Tidak mengubah throttler split-bill.
- Password: min 10 karakter; bcrypt (cost sama dengan sekarang); jangan log. Pesan galat login tetap generik (sudah begitu).
- Username unik case-insensitive (normalisasi lowercase di aplikasi + unique index).
- Nonaktifkan user = `status=DISABLED` + naikkan `tokenVersion`.
- Cookie lintas-subdomain & CORS **tidak diubah**.

## 4. Pola scoping di service

```ts
// sebelum
async getAll() { return this.prisma.bankBalance.findMany({ orderBy: { source: 'asc' } }); }
// sesudah
async getAll(userId: number) {
  return this.prisma.bankBalance.findMany({ where: { userId }, orderBy: { source: 'asc' } });
}
// controller
@Get() getAll(@CurrentUser() u: AuthUser) { return this.balance.getAll(u.id); }
```

Aturan:
- `userId` = **parameter pertama** di setiap method service tenant. Konsisten → mudah di-grep, mudah di-review.
- Method yang menerima `id` entitas (`findOne(id)`, `update(id)`, `delete(id)`) **harus** menyertakan `userId` di `where` (mis. `findFirst({ where:{ id, userId } })` atau
  `updateMany/deleteMany({ where:{ id, userId } })` lalu cek `count`) — **bukan** `findUnique({id})` lalu lupa cek pemilik. Tidak ada IDOR.
- Dalam `$transaction`, `tx.*` juga wajib memfilter `userId`.
- `adjustBalance(tx, userId, source, delta)`; `getLastManualAdjustmentAt(tx, userId, source)`; `shouldAdjustBalance` (pure) tetap.
- Service yang dipanggil dari **job/ingest/telegram** menerima `userId` yang sama; tidak ada "default user".
- Model anak (`Reimbursement`, `GoalContribution`, `ChatMessage`): validasi induk milik user sebelum menulis; baca selalu join/filter via induk atau `userId` langsung.
- Cache: `AiInsightCard`, `PeriodReport`, `BudgetAdvice`, `HealthScoreLog` — kunci cache **menyertakan userId** (unik komposit).
- Raw SQL (`retrieval.service.ts`): parameter `userId` wajib dan di-bind lewat `Prisma.sql` (tidak boleh interpolasi string).

## 5. Konfigurasi per user

### 5.1 Konteks pemilik untuk parser

```ts
export interface OwnerContext {
  fullName: string;            // uppercased
  accountNumbers: string[];    // digit-only, dari OwnAccount
  aliases?: string[];
}
// own-accounts.ts: fungsi murni menerima ctx
isInternalDestination(ctx, { accountNumber, beneficiaryName })
isOwnAccountNumber(ctx, raw)  /  isOwnerName(ctx, raw)
// EmailParser.parse(email, ctx)  /  ParserRegistry.parseEmailWithSource(email, ctx)
```

- Hapus konstanta env tingkat modul (`OWN_ACCOUNT_NUMBERS`, `OWNER_FULL_NAME`). Logika pencocokan (`matchesOwnAccount`: exact, suffix/prefix ≥ 6 digit, mask `1234xxxx90`) **tidak diubah**.
- Konteks dimuat sekali per email/per batch dari DB (`UserProfileService.getOwnerContext(userId)`), di-cache singkat.
- `income.service.ts#classify(userId, parsed)` memakai konteks yang sama; `incomeStream` & korelasi `EmailParseLog` difilter `userId`.
- `parsers.check.ts` dipindah ke konteks eksplisit + ditambah kasus **dua user dengan nama berbeda** (tidak saling cocok) dan konteks kosong (tidak ada match palsu — `''.includes('')` jebakan lama).
- Wizard mengumpulkan: nama lengkap sesuai rekening, nomor rekening (boleh beberapa), bank. Validasi: digit saja, ≥ 6 digit, dedup.

### 5.2 Provisioning user baru (`provisionUser(userId)`)

Dipanggil saat registrasi/CLI, **idempoten**: 7 baris `DailyBudget` default (Rp50.000 seperti seed — atau diisi wizard), `BudgetSetting`, `BankBalance` untuk bank yang dipilih (saldo 0, baseline manual dari wizard),
`ChatThread` Telegram dibuat saat link, `InboundAddress`. Menggantikan `prisma/seed.js` untuk data tenant (seed tinggal membuat admin).

## 6. Ingest — tiga pintu masuk, satu pipeline

```
 (A) Email forward ──▶ Cloudflare Worker ──▶ POST /ingest/email  ┐
 (B) Shortcut/HTTP ──▶ POST /ingest/transaction|income (Bearer)  ├─▶ IngestService(userId, event)
 (C) Telegram/manual UI/AI tool logExpense ─────────────────────┘      │
                                                                       ▼
                         parse (A saja) → exclude/balanceOnly/income → createFromParsed(userId, …)
                         → saldo (dalam $transaction) → kategori → alert budget → Telegram(userId)
```

Pipeline hilir **sama** dengan sekarang (`TransactionService.createFromParsed`, `IncomeService.createFromParsed`, `applyBalanceOnlyDebit`, `resolveCategory`,
`checkAndAlertIfOverBudget`) — dipindah dari `GmailSyncService` ke layanan netral (`ingest/ingest-pipeline.service.ts`) dan diberi `userId`.
`GmailSyncService` (owner-only, sementara) memanggil pipeline yang sama → **satu implementasi** (hindari divergensi).

### 6.1 Email forwarding (A)

1. **Alamat**: `u-<localPart>@in.trackster.dev`. `localPart` acak (≥ 96 bit) → tak bisa ditebak; ini penghalang spoofing utama.
2. **Cloudflare Email Routing** (subdomain `in.`) → aturan "catch-all → Email Worker". Worker (±20 baris): ambil `message.to`, `message.from`, `message.raw`;
   `POST https://api.trackster.dev/ingest/email` dengan body = raw MIME, header: `X-Trackster-To`, `X-Trackster-Timestamp`, `X-Trackster-Signature = HMAC-SHA256(secret, timestamp + "." + sha256(body))`.
   Retry 3× (backoff). Jika gagal total: `message.forward(<alamat dead-letter admin>)` supaya email tidak hilang (replay aman karena dedup).
3. **Backend `/ingest/email`** (publik tapi **bukan** pakai JWT): verifikasi HMAC + timestamp ±5 menit (anti replay) + batas ukuran (mis. 2MB; Nginx sudah 20M) → cari `InboundAddress` dari `X-Trackster-To` → `userId`.
   Tolak/abaikan (HTTP 200 agar tak ada retry & tak bocor info) bila alamat tak dikenal/nonaktif.
4. **Parse MIME** (`mailparser`, P6): ambil `Message-ID`, `From`, `Subject`, `Date`, `text`/`html` → `RawEmail` (`id = "fwd:" + sha256(Message-ID)` dipotong 32; fallback hash header+body bila tak ada Message-ID; `internalDate` = `Date` header atau waktu terima).
5. **Penyaringan (minimasi data)**: `From` domain harus ada di **allowlist bank** (`bca.co.id`, `jago.com`, `flip.id`, … — sumber kebenaran = daftar yang sama dengan parser `canHandle`).
   Bukan bank → **buang** (hitung saja di metrik, jangan simpan) — kecuali email konfirmasi forwarding Gmail (lihat 6.2).
6. **Keamanan anti-spoof (berlapis)**: (i) alamat rahasia; (ii) `X-Forwarded-For`/envelope menyebut Gmail yang didaftarkan user (`gmailSource`) — **verifikasi dengan sampel nyata** (belum terbukti, audit §10.3);
   (iii) hasil DKIM `d=` domain bank bila tersedia di `Authentication-Results` — **hanya diberlakukan jika sampel nyata membuktikan stabil**; (iv) parser sendiri menolak format yang tak dikenal.
   Pilihan ketat/longgar ditetapkan di Fase 7 berdasarkan sampel; catat di Decisions.
7. Lanjut ke pipeline §6 dengan `userId` dari alamat. `EmailParseLog` ditulis per `(userId, emailId)` (status RECORDED/EXCLUDED/UNPARSED/DUPLICATE/ERROR) — **UI "Perlu dicek/Email tak terbaca"** memakai ini.
8. **Shadow mode** (khusus migrasi owner, P3): flag per `InboundAddress` (`shadow=true`): parse + catat ke `EmailParseLog` dengan `status` khusus/`reason='SHADOW'` tetapi **tidak** menulis `Transaction`/`Income`/saldo. Skrip bandingkan ke hasil Gmail.

### 6.2 Konfirmasi forwarding Gmail

Gmail mewajibkan alamat tujuan forward diverifikasi: Gmail mengirim email ber-kode ke alamat itu. Backend mengenali (pengirim/subjek — **uji nyata**, audit §10.5) dan menyimpan kode/tautan ke
`InboundAddress.lastForwardCode(+At)`, kedaluwarsa singkat; wizard menampilkan kode itu ke user ("Salin kode ini ke Gmail"). Kode **tidak** diproses sebagai transaksi dan tidak disimpan lama.
Setelah user menyelesaikan dan email bank pertama masuk → `forwardVerifiedAt` terisi → checklist aktivasi hijau.

### 6.3 API token (B)

- Header `Authorization: Bearer trk_…`; **bukan** query string; **bukan** body. Hash SHA-256 dicari di `ApiToken` (tak direvoke) → `userId`; `lastUsedAt` di-update (throttle tulis).
- Endpoint: `POST /ingest/transaction` `{ amount, description, source?, occurredAt?, category?, note? }`, `POST /ingest/income` `{ amount, description, source?, receivedAt?, streamId? }`.
  Header `Idempotency-Key` wajib (P7) → `emailId = "ing:<key>"` (unik per user lewat `(userId, emailId)`), balasan idempoten (kode 200 + `duplicate:true`).
- Rate limit per token (mis. 60/menit) + batas jumlah token per user (mis. 5).
- `/income/quick` lama: dipertahankan **sementara** (hanya untuk Shortcut Arzaka yang lama) → ditandai deprecated → dihapus di Fase 6 akhir; berhenti menerima `JWT_SECRET`/`TELEGRAM_WEBHOOK_SECRET` segera begitu Shortcut baru terpasang.
- Respons ke Shortcut: JSON ringkas ("Tercatat Rp… — sisa budget hari ini Rp…") agar Shortcut bisa menampilkan notifikasi.

## 7. Job terjadwal per user

- Satu **`PerUserJobRunner`** (`common/per-user-runner.ts`): `runForEachActiveUser(jobName, fn, { concurrency: 1, jitterMs })` — ambil user `ACTIVE` (dan onboarded), jalankan `fn(user)` berurutan,
  `try/catch` **per user** (satu user gagal ≠ semua gagal), log `jobName userId durasi status`. Cron decorator tetap satu per job (bukan satu cron per user) → hemat memori.
- Idempotensi: job yang menulis (`close-weekly-report`, `weekly-budget-allocation`, health score) harus aman dijalankan ulang (sudah idempotent/unique per periode → kunci diperluas `(userId, periode)`).
- Beban AI: dengan N user, panggilan AI serentak ×N. Gunakan konkurensi 1–2 + jitter 0–60 dtk antar user; di Telegram kirim berurutan (rate limit Bot API ~30 msg/dtk, aman).
- `gmail-sync` cron: tetap sementara untuk owner (loop 1 user atau pengecekan `GmailToken` ada) → dihapus di Fase 7 akhir. Tidak ada polling per user baru.
- Zona waktu semua cron `Asia/Jakarta` (P5).
- `SchedulerRegistry.getCronJob('gmail-sync').nextDate()` (`GET /sync/next-run`) — endpoint sync menjadi owner-only/legacy lalu dihapus.

## 8. Telegram bersama (P2)

- Satu bot (token di env `TELEGRAM_BOT_TOKEN` — verifikasi nilai, audit §10.2), satu webhook `POST /telegram/webhook/:secret` (secret dari env, tetap).
- Tautan: Settings → "Hubungkan Telegram" → backend membuat `TelegramLinkCode` (acak, kedaluwarsa 15 menit) → user kirim `/start <kode>` ke bot → webhook menemukan kode → simpan `TelegramLink(userId, chatId)`.
  Satu `chatId` hanya boleh terhubung ke satu user (unique).
- Webhook: `chatId` → `TelegramLink` → `userId` → semua handler (chat AI, callback check-in, callback `ba:`) menerima `userId`. `chatId` tak dikenal → diam (200, tanpa info), kecuali pesan `/start <kode>`.
- `TelegramService.sendMessage(userId, text)` mengirim ke chat user itu; tak ada lagi `findFirst()`.
- Migrasi: `TelegramConfig` Arzaka → `TelegramLink` (backfill). Kolom `botToken` per user tidak dipakai lagi (hapus di C1, setelah verifikasi).
- Prompt-injection guard: `userId` untuk tool AI **diikat di server** saat membuat eksekutor tool, tidak pernah dari argumen tool yang diisi model.

## 9. AI

- `AiFinanceToolsService` tools (getTodaySummary, getWeeklySummary, getInsights, …, `logExpense`) menerima `userId` lewat closure/konteks eksekusi — **bukan** parameter tool.
- `AiMemory`, `ChatThread/Message`, `AiInsightCard`, `HealthScoreLog`, `BudgetAdvice`: per user. Prompt memakai `displayName`.
- `retrieval.service.ts` (tsvector): `JOIN "ChatThread" t ON t.id = m."threadId" WHERE t."userId" = $1`. Tes isolasi wajib (05).
- Kuota (`AiUsage`, P9) diperiksa di `AiChatService.handleMessage` dan endpoint `/ai/chat` sebelum memanggil model; respons ramah saat habis.
- `AI_API_KEY`/`SPLITBILL_AI_*` tetap milik Arzaka (env). Scan struk Split Bill publik sudah di-throttle.

## 10. Env var

| Env | Aksi |
| --- | --- |
| `OWNER_FULL_NAME`, `OWNER_ACCOUNT_NUMBERS` | Dipakai **hanya** untuk backfill awal; dihapus dari kode & compose setelah C1 |
| `ADMIN_USERNAME/PASSWORD` | Hanya seed admin awal (tetap) |
| `GMAIL_CLIENT_ID/SECRET/REDIRECT_URI` | Tetap sampai cutover owner (Fase 7), lalu dihapus |
| `QUICK_INCOME_SECRET` | Dihapus di akhir Fase 6 |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Dipakai (token kini dibaca kode) |
| **Baru:** `INGEST_HMAC_SECRET` | HMAC Worker→backend (acak ≥ 32 byte; sama dengan secret Worker) |
| **Baru:** `INBOUND_DOMAIN` (`in.trackster.dev`) | Membangun alamat per user |
| **Baru:** `MAX_USERS` (opsional, O2), `AI_DAILY_QUOTA` (O3) | Batas |
| `.env` VPS | **Manual via SSH** (tidak lewat git/CD): tulis daftar env baru di Progress Log + Runbook supaya Arzaka menambahkan sebelum deploy yang membutuhkannya; restart `docker compose up -d` (bukan `--build`) |

## 11. Frontend

- `/auth/me` mengembalikan `{ id, username, displayName, role, onboardedAt, … }`; dipakai menggantikan nama hardcode.
- Halaman publik baru: `/invite/<kode>` (daftar), `/reset/<token>`; tambahkan ke `PUBLIC_*` di `middleware.ts`.
- Wizard (`/setup`) dihubungkan ke backend (profil, rekening, saldo awal, budget, pemasukan/stream, Telegram, forwarding, token) — detail di 07. Layar `pre` Daftar/Lupa password mengikuti desain yang ada.
- Settings: kartu "Email bank (forwarding)", "Token Shortcut", "Telegram", "Profil & rekening saya", "Ganti password", "Keluar dari semua perangkat".
- Logout: hapus cookie lalu **reload penuh**; kosongkan SWR cache bila tanpa reload.
- Aturan v3 tetap: ubah desain → regenerate view; perubahan data/aksi → `useLive.ts` + cabang `live` di `logic.tsx` (CLAUDE.md "Design System").

## 12. Yang SENGAJA tidak dikerjakan (non-goals v1)

Signup publik; login Google; pembayaran/plan; zona waktu per user; budget bulanan; reset password mandiri via email; UI admin; multi-device Telegram per user;
parser bank baru di luar daftar O6 (dikerjakan per kebutuhan tester); Postgres RLS (opsional Fase 9); aplikasi mobile.
