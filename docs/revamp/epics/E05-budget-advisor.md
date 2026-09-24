# E05 — Budget Advisor

**Fase 3 · 2 sesi · Permintaan #9**

> "Atur budget harian juga harusnya ada analisis dan ada sugesti berapa per harinya bagusnya berdasarkan
> pendapatan saya minggu ini (karena data pemasukan minggu ini belum ada, mungkin bisa relate ke minggu
> sebelum atau beberapa minggu sebelumnya (AI DIPAKAI TOLONG))"

Butuh: E03-S2 (forecast pemasukan), E06-S1 (PeriodStats), E04-S4 (tool & kartu, untuk S2).

## Kondisi sekarang

- `DailyBudget` per hari-dalam-minggu: Min 0 · Sen 50rb · Sel 35rb · Rab 50rb · Kam 35rb · Jum 45rb · Sab 0 (215rb/minggu).
- `/app/budget`: form per hari + saran dari `/income/allowance-suggestion` (rata-rata income 30 hari × 0,7 —
  rusak karena income tidak dicatat sejak 24 Agu).
- Pengeluaran **rutin** nyata belum pernah diukur terpisah dari pembelian besar.

## Cara AI dipakai (jawaban untuk "AI DIPAKAI TOLONG")

Angka budget dihitung engine deterministik (bisa dites, tidak halusinasi). AI dipakai untuk bagian yang
memang butuh penilaian:
1. **Memilih & menjelaskan** opsi mana yang paling cocok minggu ini, berdasarkan memory (lagi nabung laptop,
   minggu ujian, dll) dan pola minggu lalu.
2. **Menyesuaikan konteks** yang tidak ada di data ("minggu ini ada acara ultah teman Sabtu" → geser jatah ke Sabtu)
   lewat chat — AI memanggil `proposeBudget` dengan parameter penyesuaian, engine yang menghitung ulang.
3. **Narasi mingguan** "kenapa budget ini" + satu tips spesifik dari kebiasaan (E06 habits).

## Engine (`budget-advisor.ts`, fungsi murni + `budget-advisor.check.ts`)

```
pemasukan_minggu  = forecast minggu ini (E03): kalau belum ada yang masuk, forecast sudah otomatis
                    memakai histori 8 minggu per stream → ini jawaban "relate ke minggu sebelumnya"
komitmen          = kontribusi goal mingguan yang dibutuhkan (E04 getGoals)
                  + langganan jatuh tempo minggu ini
                  + dana cadangan (default 10% pemasukan)
bisa_dipakai      = pemasukan_minggu − komitmen
bobot_hari        = median pengeluaran rutin per hari-dalam-minggu 8 minggu (E06), min 40% rata-rata
                    (supaya weekend tidak pernah 0 lagi), dinormalisasi
budget_hari[d]    = round500(bisa_dipakai × bobot_hari[d])
```

Tiga opsi:

| Opsi | Pemasukan dipakai | Tabungan/goal | Untuk |
|---|---|---|---|
| **Hemat** | konservatif | kontribusi goal penuh + cadangan 15% | minggu ketat / kejar goal |
| **Seimbang** | ekspektasi | kontribusi goal penuh + cadangan 10% | default |
| **Longgar** | ekspektasi | kontribusi goal 50% + cadangan 5% | minggu ada acara |

Tiap opsi mengembalikan: total mingguan, 7 angka harian, tabungan mingguan, dampak ke goal (minggu lebih
cepat/lambat — pakai `plan-simulator` E04), dan **realism check**: kalau median rutin 8 minggu > opsi × 1,5 →
flag "budget ini jauh di bawah kebiasaanmu (rata-rata Rp X/hari) — kemungkinan jebol".

## E05-S1 — Engine + halaman Budget v2

- [ ] `budget-advisor.ts` + check (contoh: pemasukan 1,35jt, goal 100rb/minggu, langganan 0 → angka masuk akal, weekend > 0)
- [ ] Endpoint `GET /budget/suggestions?week=` → 3 opsi + realism + input yang dipakai (transparan)
- [ ] Endpoint `POST /budget/apply {option|custom}` → tulis `DailyBudget` (pakai `updateAll` yang ada)
- [ ] Halaman `/app/budget` v2:
  1. Hero: budget hari ini & sisa minggu ini
  2. "Saran minggu ini" — 3 kartu opsi (Seimbang terpilih default), 7 batang harian mini per opsi, tabungan & dampak goal
  3. Dasar perhitungan (collapsible): pemasukan diperkirakan (per sumber), komitmen, bobot hari
  4. Analisis 4 minggu: kepatuhan per hari-dalam-minggu (hari mana yang biasanya jebol), rata-rata rutin vs budget
  5. Edit manual per hari (form lama, dipindah ke bawah) — satu CTA hijau "Terapkan"
- [ ] Hapus `/income/allowance-suggestion` lama (atau arahkan ke engine) — jangan dua sumber saran

## E05-S2 — AI: pilih, jelaskan, sesuaikan

- [ ] `AiBudgetService.explain(week)`: input = 3 opsi + snapshot + memory → output `{ recommended: 'hemat'|'seimbang'|'longgar', reason, tip }`
      (validasi JSON; gagal → default Seimbang tanpa narasi). Cache per minggu.
- [ ] Tampilkan di kartu saran: badge "Saran Track" + alasan 2 kalimat + tips
- [ ] Tool `proposeBudget({option?, dayOverrides?: {dayOfWeek, amount}[], note?})` → kartu di chat dengan tombol Terapkan
      (engine menghitung ulang sisa hari supaya total mingguan tetap)
- [ ] Check-in Minggu malam (E03-S3) ditutup dengan: "Saran budget minggu depan: Seimbang Rp45rb/hari Sen–Jum,
      Rp60rb Sab–Min. [Terapkan] [Lihat opsi]" (callback_query Telegram)
- [ ] (opsional) setting rollover: sisa budget kemarin ditambahkan ke hari ini — tanya Arzaka dulu, default off

**Acceptance:** Minggu malam Arzaka dapat satu pesan berisi saran budget minggu depan yang masuk akal
terhadap pemasukan & kebiasaannya, bisa diterapkan dengan satu tap; halaman budget menjelaskan *kenapa* angkanya segitu.
