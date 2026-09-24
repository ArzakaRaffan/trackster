# trackster — Architecture

## Modul utama
| Modul | Folder / file | Tanggung jawab |
|---|---|---|
| auth | `apps/backend/src/modules/auth` | Login username/password (bcrypt) → JWT 7d di cookie httpOnly `trackster_jwt`. `JwtAuthGuard` di `common/guards/` baca cookie itu. |
| gmail | `apps/backend/src/modules/gmail` | OAuth2 Gmail (`gmail-auth.service`), cron sync tiap 5 menit (`gmail-sync.service`), parser BCA/Jago di `parsers/` + `parser-registry.service`. |
| sync | `apps/backend/src/modules/sync` | Endpoint manual `POST /sync/trigger`, `GET /sync/next-run`, `GET /sync/logs`. Delegasi ke `GmailSyncService`. |
| transaction | `apps/backend/src/modules/transaction` | CRUD transaksi, weekly/monthly/summary/insights, note/category/alias. Tiap create/delete gerakin saldo. |
| balance | `apps/backend/src/modules/balance` | `BankBalance` per source, `adjustBalance(tx, source, delta)` dipanggil dalam Prisma tx modul lain, koreksi manual → `BalanceAdjustment`. |
| income | `apps/backend/src/modules/income` | Pemasukan manual (BCA tak ada parser income). Create/edit/delete → adjust saldo selisihnya. |
| budget | `apps/backend/src/modules/budget` | `DailyBudget` per hari-dalam-minggu, `GET /budget/today` = summary spent vs budget. |
| telegram | `apps/backend/src/modules/telegram` | Config bot (DB), kirim alert over-budget (1x/hari via `AlertLog`) + notif per-transaksi opsional. |
| merchant-alias | `apps/backend/src/modules/merchant-alias` | `MerchantAlias` — nama panggilan merchant, match by `rawDescription` string (bukan FK). |
| split-bill | `apps/backend/src/modules/split-bill` | Fitur publik bagi tagihan, terisolasi dari Transaction/BankBalance. `publicSlug` (lihat) vs `ownerToken` (kelola tanpa login). Scan struk via `split-bill-ai.service` (Claude vision di mwapi.dev). |

## Data flow
- Email bank masuk Gmail → cron 5 menit `GmailSyncService.syncEmails()` → `messages.list` query `from:(bca OR jago) newer_than:7d` → `extractBody` (text/plain, fallback HTML → `htmlToText` per baris) → `ParserRegistryService` → `TransactionService.createFromParsed` (dedup by `emailId`, saldo −amount dlm 1 tx) → kalau over-budget & belum alert hari ini → Telegram.
- Frontend: `useSWR` + `apps/frontend/src/lib/api.ts` (`fetch` `credentials:'include'`, 401 → auto logout+redirect `/login`). `middleware.ts` gate path privat vs publik.

## Database
- ORM: Prisma 5 | Schema: `apps/backend/prisma/schema.prisma`
- Tabel penting: `Transaction` (`emailId` unique dedup; manual = `manual:<uuid>`), `Income`, `BankBalance` (live incremental per `Source` BCA/JAGO/GOPAY), `BalanceAdjustment` (koreksi manual saja), `DailyBudget`, `AlertLog` (`@@unique([date])`), `GmailToken`, `TelegramConfig`, `MerchantAlias`, `SplitBill`/`SplitBillParticipant`/`SplitBillItem`.
- Migrasi: dev `npx prisma migrate dev`; prod `npx prisma migrate deploy` otomatis di CMD Dockerfile tiap container start.

## Integrasi eksternal
- Gmail API (`googleapis`) — `gmail-auth.service.ts` / `gmail-sync.service.ts`, env `GMAIL_CLIENT_ID/SECRET/REDIRECT_URI`, refresh token di tabel `GmailToken`.
- Telegram Bot API (`node-telegram-bot-api`) — `telegram.service.ts`, kredensial di tabel `TelegramConfig` (via Settings UI).
- Claude vision via mwapi.dev — `split-bill-ai.service.ts`, env `SPLITBILL_AI_*`, hanya untuk scan struk Split Bill.

## Batas sistem (jangan dilewati)
- Single-user: tak ada signup, tak ada multi-tenant. `User` cuma di-seed dari `ADMIN_USERNAME/PASSWORD`.
- Split Bill SENGAJA tidak menyentuh `Transaction`/`BankBalance` — jaga saldo tetap "live incremental" murni.
- Saldo TIDAK PERNAH dihitung ulang dari agregat; hanya bergerak lewat `adjustBalance` dalam Prisma transaction bareng operasi utamanya.
- GoPay tidak diparse sama sekali (enum ada, parser tidak didaftarkan di `parser-registry.service`).
- Auth flow (middleware, cookie httpOnly, `COOKIE_DOMAIN` cross-subdomain) sudah settled — jangan diubah tanpa alasan kuat.
