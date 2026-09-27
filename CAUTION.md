# CAUTION — RAM di VPS ini (baca sebelum build/run apapun)

**Kejadian nyata (2026-09-28):** sesi Claude Code menjalankan `npm run build` tanpa cap memory,
lalu `npm run start:dev` (juga tanpa cap) sambil `trackster-dev-postgres-1` (salinan DB dev) masih
nyala berdampingan dengan `trackster-postgres-1`/`trackster-backend-1`/`trackster-frontend-1` prod
yang sedang jalan. Total kebutuhan RAM lebih dari 2GB fisik VPS → OOM killer turun tangan → **prod
down**. Jangan ulangi ini.

## Aturan wajib

1. **VPS ini cuma 2GB RAM**, dan prod (`trackster-backend-1`, `trackster-frontend-1`,
   `trackster-postgres-1`, `trackster-nginx-1`) **selalu jalan** di sini memakan porsi tetap.
   Sisa RAM buat kerjaan development sangat tipis (~1GB, sering kurang).
2. **`npm run build` dan `npm run start:dev` di `apps/backend` WAJIB pakai cap memory**, tanpa
   kecuali:
   ```bash
   NODE_OPTIONS=--max-old-space-size=1536 npm run build
   NODE_OPTIONS=--max-old-space-size=1536 npm run start:dev
   ```
   Tanpa cap ini, proses `tsc`/`webpack` bisa coba pakai RAM sampai node default limit (biasanya
   >2GB di mesin modern) dan memicu OOM sebelum sempat dibatasi swap.
3. **Jangan jalankan lebih dari satu proses berat RAM secara bersamaan.** Build backend, start:dev
   backend, `docker compose build`, dan container `trackster-dev-postgres-1` masing-masing makan
   ratusan MB–1GB+. Kombinasi dua atau lebih dari itu berbarengan = OOM. Kerjakan satu-satu:
   - Selesai `npm run build` / `npm run start:dev` dulu → baru start dev Postgres kalau perlu.
   - Selesai pakai `trackster-dev-postgres-1` → langsung `docker compose -p trackster-dev down`,
     jangan dibiarkan nyala di background sambil ngerjain hal lain yang butuh RAM.
4. **Build Docker image di prod** (`docker compose -f docker-compose.prod.yml build ...`) HARUS
   sequential (backend dulu, baru frontend) — ini sudah ada di `CLAUDE.md`/Gotchas, tapi berlaku
   juga ke kombinasi build lokal (`npm run build`) + docker build: jangan bersamaan.
5. **Personal project, single user** — Arzaka mengizinkan testing langsung terhadap `main`/prod
   kalau itu bikin alur kerja lebih simpel (nggak perlu selalu spin up salinan dev DB terpisah).
   Tapi tetap: backup dulu sebelum operasi apapun yang mengubah data
   (`docker exec trackster-postgres-1 pg_dump -U trackster trackster > ~/backup-$(date +%F-%H%M).sql`),
   dan tetap hormati aturan RAM di atas — "boleh test di main" bukan izin buat menjalankan banyak
   proses berat bersamaan.
6. Setelah selesai kerja yang butuh proses background (dev server, dev DB), **matikan lagi**
   sebelum lanjut ke task lain atau mengakhiri sesi. Jangan tinggalkan `nest start --watch` atau
   container dev nyala tanpa alasan.

## Kalau curiga OOM sudah/lagi terjadi

```bash
free -h                                   # cek swap/available
dmesg -T | grep -i "out of memory" | tail # konfirmasi OOM killer
docker ps -a --format '{{.Names}}\t{{.Status}}'  # cek container mana yang mati/restart
```
Container prod biasanya auto-restart (`restart: unless-stopped` di compose) begitu OOM killer
selesai membunuh proses yang paling banyak makan RAM — tapi tetap verifikasi manual
(`curl -I https://track.trackster.my.id`, `curl -I https://api.track.trackster.my.id/auth/me`)
sebelum lapor "sudah pulih".
