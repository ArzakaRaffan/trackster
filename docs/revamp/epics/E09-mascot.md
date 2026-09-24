# E09 — Mascot "Track" v2: blob simpel, HIGHLY animated, terasa buddy

**Fase 4 (independen — frontend murni, boleh dikerjain paralel kapan saja) · 3 sesi · Permintaan #10**

> "Animasi dan character dari mascott track masih AI generated sekali. Saya ingin AI nya blob dan simple
> (satu warna atau bisa berubah warna gapapa), tapi HIGHLY ANIMATED!!!! dan memang terasa seperti 'teman' atau 'buddy'"

## Kenapa yang sekarang terasa "AI generated" ([findings G](../01-findings.md#g-mascot))

`TracksterMascot.tsx`: gradient radial + highlight putih + drop shadow + mulut kecil = tampilan "clip-art 3D"
generik. Animasinya cuma float/breathe/blink yang sama terus, tidak bereaksi ke apa pun → terasa seperti
stiker, bukan makhluk. Path morph dimatikan (commit `aedb476`) karena bentuk "warp".

## Arah karakter

- **Bentuk:** satu blob bulat-lonjong, **satu warna flat** (tanpa gradient, tanpa highlight, tanpa drop shadow).
  Karakter datang dari **gerak**, bukan detail.
- **Wajah:** hanya **dua mata** (pil/oval hitam `#121212`). Mulut cuma muncul saat perlu (bicara, kaget, "nom").
  Semua emosi diekspresikan lewat bentuk mata + badan.
- **Warna = mood**, transisi halus, pakai token yang ada (`design_system/tokens/colors.css`):
  tenang `--green #1ed760` · senang lebih terang (mix green→white 15%) · khawatir `--orange #ffa42b` ·
  alarm `--red #f3727f` · berpikir `--blue #539df5` · ngantuk abu (`--gray-silver`).
- **Kepribadian:** penasaran, gampang excited, sedikit dramatis soal uang (kayak peliharaan yang ikut deg-degan
  lihat saldo). Tidak pernah menghakimi.

## Teknik (tanpa dependency baru)

Procedural SVG + `motion/react` (sudah terpasang). Alasan tidak pakai Rive/Lottie: Lottie tidak interaktif;
Rive butuh editor + aset + runtime ~150KB dan susah dihubungkan ke data app. Kalau suatu saat mau animasi
hand-crafted, Rive adalah jalur upgrade-nya.

**Badan — kenapa tidak warp lagi:** path dibangun ulang tiap frame dari **jumlah titik yang tetap** (N = 10) dalam
koordinat polar, lalu dihaluskan (Catmull-Rom → cubic Bézier). Karena topologinya selalu sama, tidak ada
interpolasi antar-path yang beda struktur (sumber warp di versi lama).

```
r(θ, t) = R · (1 + Σ_{k=2..4} a_k · sin(kθ + ω_k·t + φ_k))      // goyangan jeli, a_k 1–4%
titik   = (cx + r·cosθ·scaleX, cy + r·sinθ·scaleY) + stretch ke arah kecepatan (saat drag/lompat)
scaleX/scaleY/y = spring (squash & stretch), volume dijaga: scaleX ≈ 1/scaleY
```
- Loop pakai `useAnimationFrame` (motion), **satu loop per instance**, berhenti kalau tidak terlihat
  (IntersectionObserver) atau `document.hidden`.
- `useReducedMotion()` → pose statis per mood (warna + bentuk mata), tanpa loop, tanpa partikel.

**Mata:** posisi pupil mengikuti target (kursor/jari/elemen), dibatasi radius; kedip acak 2–6 detik, kadang dobel.
Bentuk per emosi: normal (oval tegak) · senang (`^ ^` busur) · excited (`> <`) · ngantuk (garis) · kaget
(lingkaran besar) · sedih (oval miring turun) · pusing (spiral) · fokus (oval menyipit).

**Partikel (hemat, maksimal 1 efek aktif):** tetes keringat, `z z z`, kilau, koin kecil, confetti, titik-titik berpikir.

## API komponen

```tsx
// apps/frontend/src/components/track/Track.tsx
<Track size={48} mood="idle" interactive lookAt="pointer" />
// mood: 'idle'|'happy'|'excited'|'worried'|'alarm'|'thinking'|'talking'|'sleepy'|'sad'

// apps/frontend/src/components/track/trackBus.ts — event bus kecil (window CustomEvent, tanpa context global)
emitTrack('transaction:new' | 'income:in' | 'budget:near' | 'budget:over' | 'goal:reached' | 'sync:start' | 'sync:end' | 'ai:thinking' | 'ai:reply')
```
`TracksterMascot` lama diganti; tipe `MascotMood` dipetakan ke mood baru supaya pemakai lama tidak rusak.

## Perilaku (state machine `useReducer`)

| Pemicu | Reaksi |
|---|---|
| Diam | napas + jeli halus; tiap 8–20 detik aksi kecil acak: lirik kiri-kanan, lompat kecil, meregang, menguap |
| Kursor/jari mendekat | mata mengikuti, badan condong ke arah kursor |
| Tap | squash → mantul → mata `^ ^`, "hihi" (bubble kecil opsional) |
| Tap cepat ≥4× | pusing (spiral), goyang, pulih |
| Drag | badan memanjang ke arah tarikan (sesuai kecepatan), dilepas → pegas kembali + goyang; nabrak tepi = "bonk" |
| 60 detik tanpa interaksi | ngantuk → tidur (`z z z`, napas lambat); gerakan kursor → kaget bangun |
| Mengetik di chat | "mendengarkan": condong ke input, mata ke teks |
| `ai:thinking` | mata ke atas, badan berputar pelan, titik-titik |
| `ai:reply` | mulut buka-tutup mengikuti teks muncul, lalu senang |
| `transaction:new` | melirik, koin jatuh → "nom" (mulut), kembali normal |
| `budget:near` | warna → oranye, mata khawatir |
| `budget:over` | warna → merah, tetes keringat, gemetar singkat |
| `income:in` | lompat tinggi + kilau, warna terang sebentar |
| `goal:reached` | confetti + putar 360° + excited |

Sumber event: SWR data yang sudah ada (mis. `/budget/today` berubah status → `budget:near/over`; jumlah transaksi
hari ini bertambah → `transaction:new`), halaman chat (`ai:thinking`/`ai:reply`), aksi user (goal selesai).
Jangan tambah polling baru khusus mascot.

---

## E09-S1 — Engine blob + mata + emosi + playground

- [ ] Eksplorasi visual cepat dulu: halaman playground `/app/dev/track` (tidak ditautkan dari nav) berisi Track di 4
      ukuran (24/48/96/200), tombol semua mood & event, slider parameter jeli. **Minta Arzaka lihat & setuju** bentuk,
      proporsi mata, warna sebelum lanjut (kirim screenshot/GIF).
- [ ] `Track.tsx`: path prosedural (fungsi murni `blobPath(points, t, params)` + check kecil: path selalu tertutup,
      jumlah segmen tetap), mata + 8 bentuk emosi, transisi warna, reduced-motion
- [ ] Loop berhenti saat tidak terlihat (cek DevTools Performance: idle < ~2ms/frame)

## E09-S2 — Interaksi + reaksi event

- [ ] Look-at pointer, tap/bounce, tap cepat → pusing, drag dengan stretch & pegas, tidur/bangun
- [ ] `trackBus` + mapping semua event di tabel
- [ ] Partikel (keringat, zzz, kilau, koin, confetti, titik berpikir)
- [ ] Uji di HP (touch) & desktop (mouse); 60fps di mobile menengah

## E09-S3 — Pasang di seluruh app

- [ ] **Floating buddy** (`MascotWidget`): ganti ke Track 48–56px, bisa di-drag ke pojok mana pun (posisi di localStorage),
      bubble tip tetap (reminder/fact), reaksi event global
- [ ] **Chat** (`/app/chat`): Track di header & sebagai avatar balasan — thinking saat request, talking saat balasan muncul
- [ ] **Dashboard** (`/app`): sapaan dengan mood sesuai status budget hari ini
- [ ] **Empty & loading state**: Track mengintip dari tepi kartu (ganti beberapa skeleton kosong)
- [ ] **Login**: mata mengikuti kursor saat isi username, **menutup mata saat isi password** 🙈
- [ ] **Landing page publik** & 404: Track besar, interaktif (daya tarik untuk fitur publik E08)
- [ ] Hapus `TracksterMascot.tsx` lama setelah semua pemakai pindah (`grep TracksterMascot`)

**Acceptance:** Arzaka pengen nge-tap/nge-drag Track tanpa alasan; Track bereaksi berbeda ke pemasukan, over-budget,
dan chat; tidak ada lag di HP; reduced-motion tetap rapi.
