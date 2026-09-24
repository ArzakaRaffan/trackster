# trackster — Overview

> **Revamp v2 sedang berjalan (mulai 2026-09-24)** — rencana, status, dan aturan kerja di `docs/revamp/README.md`.
> Kalau task-mu bagian dari revamp, baca itu + `docs/revamp/02-conventions.md` + satu file epic.

**Apa ini:** Personal finance expense tracker single-user (Arzaka). Otomatis mencatat pengeluaran dari notifikasi email bank BCA & Jago (parser Gmail API), tracking budget harian, alert Telegram kalau over-budget, plus laporan/insight. Termasuk fitur publik terpisah: Split Bill (bagi tagihan) & Kalkulator Target Tabungan.
**Stack:** TypeScript. Backend NestJS 10 + Prisma 5 + PostgreSQL 16 (`apps/backend`). Frontend Next.js 14 App Router + Tailwind + SWR (`apps/frontend`). Deploy Docker Compose di VPS + Nginx + Let's Encrypt, GitHub Actions CD tiap push `main`.

**Cara jalan (dev):**
```bash
cp .env.example .env
docker compose up -d postgres          # postgres di host port 5434
cd apps/backend && npm install && npx prisma migrate dev && npx prisma db seed
cd ../frontend && npm install
# dua terminal:
cd apps/backend && npm run start:dev   # http://localhost:4000
cd apps/frontend && npm run dev        # http://localhost:3000
```
**Cara jalan (prod):**
```bash
docker compose -f docker-compose.prod.yml up -d --build   # build backend lalu frontend sequential (RAM 2GB)
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed   # sekali di awal, seed TIDAK otomatis
```
**Entrypoint utama:** `apps/backend/src/main.ts` (NestFactory, cookie-parser, CORS credentials), `apps/frontend/src/app/layout.tsx` + `apps/frontend/src/middleware.ts` (auth redirect).
**Env wajib:** `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `OWNER_FULL_NAME`, `GMAIL_CLIENT_ID/SECRET/REDIRECT_URI`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, `COOKIE_DOMAIN` (prod), `SPLITBILL_AI_API_KEY/BASE_URL/MODEL` (lihat `.env.example`). Telegram bot token & chat ID disimpan via halaman Settings, bukan env.

**Layanan / repo saudara di VPS ini** (Nginx multi-vhost di `nginx/conf.d/`, network `shared-web-net`):
- `trackster` — app ini: `track.trackster.my.id` (frontend), `api.track.trackster.my.id` (backend)
- `ai-trackster` — `ai.trackster.my.id` / `api.ai.trackster.my.id` → `ai-frontend:3100` / `ai-backend:4100`
- `charon` — `charon.trackster.cloud` → `host.docker.internal:3001` (basic auth via `charon.htpasswd`)
- `dlmm` — `dlmm.trackster.my.id` → `host.docker.internal:3300`
- `isistasiun` — `api.dev.isistasiun.trackster.cloud`
