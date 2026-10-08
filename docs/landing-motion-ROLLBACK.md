# Motion landing & halaman publik — cara rollback

Dirilis 2026-10-08. Tag `landing-pre-motion` = commit `main` tepat sebelum motion masuk.

## 1. Bandingkan dulu (tanpa rollback)
Tambahkan `?motion=0` di URL → tampilan lama persis, motion mati:
- `https://trackster.dev/?motion=0`
- `https://trackster.dev/tools?motion=0` (berlaku juga untuk kalkulator, split bill, trip)

## 2. Rollback permanen (disarankan) — revert commit lalu push, CD deploy otomatis
```bash
git checkout main && git pull
git revert --no-edit $(git log --format=%H --grep='^feat(landing): motion' -1)
git push origin main
```

## 3. Rollback darurat di VPS (tanpa menunggu CI, ~1 menit)
Image frontend versi sebelum motion masih ada di GHCR dengan tag SHA commit:
```bash
cd ~/trackster && git fetch origin --tags   # folder deploy di VPS
IMAGE_TAG=$(git rev-parse landing-pre-motion) docker compose -f docker-compose.prod.yml up -d frontend
```
Push berikutnya ke `main` mengembalikan ke `latest` — jadi tetap lakukan langkah 2 kalau mau permanen.

## File yang terlibat (hapus ini = motion hilang)
- `apps/frontend/src/components/v3/LandingMotion.tsx`, `landing-motion.css`, satu baris mount di `V3Host.tsx`
- `apps/frontend/src/app/(public)/pub-motion.css`, satu baris import + `?motion=0` di `(public)/layout.tsx`
