# Trackster

Personal finance expense tracker — otomatis mencatat pengeluaran dari notifikasi email bank (BCA, Jago), cek budget harian, dan kirim alert Telegram kalau kelampauan.

Lihat `TRACKSTER_BUILD_PLAN.md` untuk detail arsitektur lengkap.

## Quick Start (Development)

```bash
cp .env.example .env
# isi .env dengan credentials kamu (lihat komentar di dalam file)

docker compose up -d postgres
cd apps/backend && npm install && npx prisma migrate dev && npx prisma db seed
cd ../frontend && npm install

# jalankan dua terminal terpisah:
cd apps/backend && npm run start:dev   # http://localhost:4000
cd apps/frontend && npm run dev        # http://localhost:3000
```

Login default: username `admin`, password sesuai `ADMIN_PASSWORD` di `.env` (ganti setelah login pertama).

## Production (VPS)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Pastikan `.env` sudah diisi lengkap dan Nginx + SSL sudah dikonfigurasi (lihat `nginx/`).
