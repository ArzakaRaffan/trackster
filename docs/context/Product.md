# Trackster — Product Context (kenapa & buat siapa)

Baca ini buat ngerti *maksud* fitur sebelum ngubah logic. Detail teknis & gotcha ada di `CLAUDE.md`,
peta kode ada di `Codemap.md`.

## Satu kalimat

Teman finansial pribadi Arzaka: baca email notifikasi bank → catat pengeluaran otomatis → jaga
budget harian → negur lewat Telegram → kasih insight/nasihat lewat AI.

## User & masalah

- **Satu user: Arzaka** — mahasiswa yang lagi magang, pemasukan dari beberapa sumber, mau kontrol
  jajan harian biar nggak boros.
- Masalah awal: semua expense tracker minta input manual per transaksi → nggak pernah konsisten.
  Bank Indonesia nggak punya API publik buat individu, jadi **email notifikasi = satu-satunya sumber
  data otomatis**. Itu inti produknya; fitur lain nempel di atasnya.
- Sukses = pengeluaran tercatat tanpa sentuh apa-apa, dan Arzaka tahu *hari ini* masih aman atau
  sudah jebol.

## Alur uang nyata (WAJIB paham sebelum sentuh parser/saldo)

```
Pemasukan (gaji/magang, dll) ──► BCA  (rekening utama, pengeluaran besar/di luar jatah)
                                  │
                                  ├─ transfer via Flip (SoF = BCA) ──► Jago  (jatah jajan mingguan weekday)
                                  │                                   └─► merchant/orang lain = EXPENSE
                                  ├─ top-up GoPay via VA BCA = EXPENSE (tercatat dari email BCA)
                                  └─ QRIS / transfer ke pihak lain = EXPENSE
```

- Pindah uang antar kantong sendiri (BCA→Jago, Jago→BCA, ke Blu) **bukan expense** — kalau ikut
  dihitung, pengeluaran dobel. Semua exclusion rule di parser ada untuk mencegah double-count ini.
- Rekening sendiri: BCA, Jago, Blu (`OWNER_ACCOUNT_NUMBERS`), nama `OWNER_FULL_NAME`.
- GoPay nggak di-track langsung: top-up-nya selalu dari BCA, jadi sudah tertangkap di sana.
  Enum `Source.GOPAY` masih ada tapi nggak ada parser/sumber aktif.
- Income BCA **selalu manual** (BCA nggak kirim email dana masuk — sudah dicek).

## Konsep domain

| Istilah | Arti |
| --- | --- |
| Expense / Transaksi | Uang keluar ke pihak luar. Dari sync email atau input manual (`isManual`, `emailId = manual:<uuid>`). |
| Budget harian | Nominal per hari-dalam-minggu (0=Minggu..6=Sabtu). Jebol → alert Telegram, maks 1x/hari (`AlertLog`). |
| Saldo (BankBalance) | Live incremental per bank, baseline manual. Bukan hasil agregasi. |
| Koreksi saldo | Delta manual + note → `BalanceAdjustment`. Cuma buat koreksi, bukan tiap transaksi. |
| Merchant alias | Nama panggilan buat `description` mentah (match string persis, bukan FK). |
| Kantong (Goal) | Target tabungan + kontribusi (negatif = tarik). Nggak nyentuh saldo bank. |
| Langganan | Tagihan berulang, dikelola manual, reminder via Google Calendar. |
| Health Score | Skor 0-100 mingguan, dihitung algoritmik; AI cuma nambah 1 kalimat komentar. |
| Runway | Proyeksi akhir bulan dari burn rate 7 hari. Deterministik, tanpa LLM. |
| Alokasi income | Sisa (income mingguan − target budget mingguan) dibagi 50% tabung / 30% investasi / 20% jajan. |

## Dua dunia dalam satu repo

1. **Finance tracker privat** (`/app/*`, login JWT) — semua di atas.
2. **Tools publik tanpa login** — lahir dari codebase ini, sengaja **terisolasi** dari
   Transaction/BankBalance:
   - **Split Bill** (`/split-bills/*`, share `/s/[slug]`): scan struk pakai AI vision, assign item ke
     teman, teman tandai lunas. `publicSlug` (lihat & tandai lunas) ≠ `ownerToken` (kelola, tanpa login).
   - **Kalkulator Target Tabungan** (`/savings-calculator`): one-shot, CTA ke `/app/goals`.
   - Landing page `/` memposisikan Trackster sebagai "finance buddy".

## Lapisan AI ("Financial Buddy")

Semua di-acc & selesai 2026-09-21 (lihat `TRACKSTER_AI_FEATURES_PLAN.md` untuk konvensi):
- **Tanya Track** — chat web + Telegram, tool-calling ke data keuangan nyata (bukan ngarang angka).
- **Quick entry via chat** — tool `logExpense`.
- **Auto-kategori** transaksi dari email; gagal → `LAINNYA`, nggak pernah bikin sync gagal.
- **Laporan otomatis ke Telegram** — insight mingguan (Minggu 20:00 WIB) + report card bulanan
  (hari terakhir bulan 20:00 WIB).
- **Mascot widget** — tips/fun fact + reminder langganan terdekat.
- Ditolak user: Calendar Sync untuk transaksi.

Prinsip: angka selalu dihitung kode, AI cuma merangkai kata/nasihat. Kalau LLM gagal, fitur inti
tetap jalan.

## Non-goals (jangan dibangun tanpa diminta)

- Multi-user, signup, tenant.
- Integrasi API bank / e-wallet langsung.
- Parser GoPay, parser income BCA.
- Mobile app native.
