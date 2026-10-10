# Motion landing & halaman publik — cara rollback

Dirilis 2026-10-08. Tag `landing-pre-motion` = commit `main` tepat sebelum motion masuk.

## 1. Rollback permanen (disarankan) — revert commit lalu push, CD deploy otomatis
```bash
git checkout main && git pull
# revert 2 commit motion sekaligus (yang terbaru dulu, urutan dari git log sudah benar)
git revert --no-edit $(git log --format=%H -E --grep='^(feat\(landing\): motion|chore\(landing\): hapus kill switch)')
git push origin main
```

## 2. Rollback darurat di VPS (tanpa menunggu CI, ~1 menit)
Image frontend versi sebelum motion masih ada di GHCR dengan tag SHA commit:
```bash
cd ~/trackster && git fetch origin --tags   # folder deploy di VPS
IMAGE_TAG=$(git rev-parse "landing-pre-motion^{commit}") docker compose -f docker-compose.prod.yml up -d frontend
```
Push berikutnya ke `main` mengembalikan ke `latest` — jadi tetap lakukan langkah 1 kalau mau permanen.

## File yang terlibat (hapus ini = motion hilang)
- `apps/frontend/src/components/v3/LandingMotion.tsx`, `landing-motion.css`, satu baris mount di `V3Host.tsx`
- `apps/frontend/src/app/(public)/pub-motion.css`, satu baris import di `(public)/layout.tsx`
