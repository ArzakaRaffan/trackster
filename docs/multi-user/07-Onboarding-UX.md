# 07 — Onboarding: Wizard, Tutorial, Checklist Aktivasi, Zero-State

Alur target: **Arzaka membuat undangan → tester membuka tautan → daftar → wizard → tutorial → checklist aktivasi → pakai penuh.**
Wizard saat ini (`/setup`, layar `pre` di `logic.tsx`) adalah **tampilan saja**; fase 8 menjadikannya nyata. Aturan desain proyek berlaku:
sumber kebenaran layar = `docs/Rework Design Trackster/` (generator `scripts/dc-to-tsx.mjs`); perubahan data/aksi → `useLive.ts` + cabang `live` di `logic.tsx`.
Jangan magic number Tailwind; token ada di `logic.tsx` (`DARK/LIGHT/DENSITY`).

## 1. Prinsip UX (untuk orang yang tidak sehebat Arzaka dalam hal teknis)

1. **Satu langkah, satu tugas, satu tombol utama.** Progres terlihat (mis. "Langkah 3 dari 7").
2. **Bisa dilewati & dilanjutkan.** Langkah teknis (forwarding, Shortcut, Telegram) boleh ditunda; app tetap dapat dipakai (input manual di app). Progres tersimpan di server.
3. **Setiap langkah punya "tes langsung"** ("Kirim email uji" / "Catat transaksi uji") dan status hijau otomatis saat terdeteksi.
4. **Bahasa jujur soal privasi:** apa yang dikirim ke Trackster (hanya email bank yang kamu forward), apa yang tidak (email lain), siapa yang bisa melihat data (admin = Arzaka secara teknis bisa membaca database — O4), cara menghapus akun.
5. **Tidak ada jargon:** "forward email" dijelaskan dengan gambar; kode konfirmasi Gmail ditampilkan di tempat yang sama.
6. **Gagal dengan ramah:** setiap kegagalan menjelaskan penyebab + tindakan.

## 2. Langkah wizard (usulan — selaraskan dengan layar prototipe yang ada)

| # | Langkah | Data yang dikumpulkan | Efek backend | Wajib? |
| --- | --- | --- | --- | --- |
| 0 | Daftar via undangan | username, password | `POST /auth/register` → `provisionUser` | ya |
| 1 | Kenalan | nama panggilan (`displayName`), **nama lengkap sesuai rekening** (`fullName`) | `User` | ya |
| 2 | Rekening | bank (BCA/Jago/BNI/Mandiri/Raya/BRI/…; O6), nomor rekening (boleh >1) | `OwnAccount`, `BankBalance` baris per bank | ya |
| 3 | Saldo awal | saldo saat ini per bank (baseline) | `BalanceAdjustment` baseline manual per bank (aturan baseline otomatis berlaku) | ya (boleh 0) |
| 4 | Pemasukan | template: gaji bulanan · uang saku mingguan · per sesi (les/freelance) · variabel rutin · tak tentu | `IncomeStream` (`cadence`, `kind`, `payDayOfWeek/Month`, `amount`/`sessionRate`, `matchKeywords`) — **di sinilah mingguan vs bulanan ditentukan per user** | boleh dilewati |
| 5 | Budget | budget harian (satu angka → disalin ke 7 hari; atau saran dari pemasukan) | `DailyBudget` ×7 | ya (default Rp50.000) |
| 6 | Sambungkan catatan otomatis | pilih jalur: **Email forward** · **Shortcut** · **Manual** (boleh semua) | lihat §3–§4 | boleh dilewati |
| 7 | Telegram (opsional) | tombol "Hubungkan" → kode `/start` | `TelegramLink` | opsional |
| 8 | Selesai | ringkasan + checklist aktivasi | `onboardedAt` | — |

Pemasukan **bulanan** vs **mingguan** harus punya jalur yang sama jelasnya. Forecast/alokasi mingguan sudah menangani stream bulanan (`payDayOfMonth`) —
tetapi **belum diuji untuk user bulanan-murni**; ini wajib diuji di F8 (P8-06) dan hasilnya dicatat (bisa memicu penyesuaian teks/perhitungan, bukan perubahan arsitektur).

## 3. Tutorial: Forward email bank (Gmail)

Layar bertahap dengan gambar (screenshot **tanpa data nyata**):
1. Tampilkan alamat unik user: `u-xxxxxxxx@in.trackster.dev` + tombol Salin. Peringatan: "rahasiakan alamat ini".
2. "Di Gmail → Setelan → Penerusan dan POP/IMAP → Tambahkan alamat penerusan → tempel alamat ini."
3. Gmail mengirim kode ke alamat itu → Trackster **menampilkan kodenya di sini** (auto-refresh); user menyalinnya ke Gmail → konfirmasi. (Verifikasi format email konfirmasi dulu — audit §10.5.)
4. **Buat filter** (bukan teruskan semua email!): tombol "Salin query filter" menghasilkan `from:(<domain bank pilihan>)`; instruksi: Gmail → Setelan → Filter → buat filter → "Teruskan ke" alamat ini.
5. **Tes:** "Kirim email uji" (atau tunggu transaksi berikutnya) → status hijau saat email bank pertama sampai (`forwardVerifiedAt`).
6. Jika tak ada email dalam X hari → peringatan di app/Telegram dengan langkah pemeriksaan (filter mati? forwarding dinonaktifkan Gmail?).

Catatan teknis penting: forwarding Gmail hanya meneruskan **email baru** — email lama tidak masuk. Untuk riwayat awal, user input saldo (langkah 3) dan, jika perlu, impor manual (di luar v1).

## 4. Tutorial: Shortcut iPhone & input manual

- Halaman "Token Shortcut": buat token (label "iPhone saya"), tampil sekali, tombol Salin; daftar token + `lastUsedAt` + Cabut.
- Panduan Shortcut (gambar): langkah 1) "Ask for Input" nominal & deskripsi; 2) "Get Contents of URL" → POST `https://api.trackster.dev/ingest/transaction`, header `Authorization: Bearer <token>`, `Idempotency-Key: <UUID baru>`, body JSON; 3) tampilkan hasil. Varian pemasukan.
- Android (O7): HTTP Shortcuts/Tasker atau jalur Telegram (`logExpense` via chat) sebagai alternatif.
- Jalur manual di app tetap ada (tombol tambah transaksi/pemasukan) sebagai cadangan.

## 5. Checklist aktivasi di dashboard

Kartu tetap tampil sampai semua selesai/ditutup. Setiap item terdeteksi **otomatis** (bukan klik "sudah"):

| Item | Terdeteksi saat |
| --- | --- |
| Profil & rekening | `fullName` + ≥1 `OwnAccount` |
| Saldo awal | ada `BalanceAdjustment` baseline |
| Pemasukan diatur | ≥1 `IncomeStream` aktif |
| Budget diatur | `DailyBudget` diubah dari default atau dikonfirmasi |
| Email forwarding aktif | `forwardVerifiedAt` terisi |
| Shortcut aktif | token dipakai (`lastUsedAt`) |
| Telegram terhubung | `TelegramLink` ada |
| Transaksi pertama tercatat | ≥1 `Transaction` |

State disimpan di server (menggantikan `v3-coach-hide` di localStorage untuk onboarding). Coach mark kontekstual (`coachShow` di dashboard) dipertahankan tetapi per-user.

## 6. Zero-state (akun kosong)

Lihat daftar & skenario di [`04 §D`](04-Checklist.md). Aturan:
- Tidak pernah menampilkan angka palsu/contoh di mode `live` (data contoh hanya di `/demo`).
- Empty state memberi **tindakan berikutnya** (mis. "Belum ada transaksi — catat via Shortcut atau tunggu email bank pertama").
- AI (chat, mascot, insight, health score, laporan) harus sopan tanpa data ("Belum cukup data untuk analisis — butuh ≥ N transaksi").
- Laporan periode (`close-weekly/monthly-report`) tidak dibuat untuk periode sebelum user dibuat.
- Nama "Arzaka" tidak boleh muncul di mode live (gunakan `displayName`).

## 7. Teks yang perlu ditulis ulang

- FAQ "Apakah aman Trackster membaca email bank?" (`logic.tsx`): jelaskan model forwarding, filter hanya bank, dibuang bila bukan bank, tidak menyimpan isi email.
- `/app/privacy`: siapa admin, data apa disimpan, retensi, ekspor, hapus akun (O4/O5).
- `/app/sources`: "Sumber catatan" (email forwarding, Shortcut, manual, Telegram) menggantikan "Sambungkan Gmail".
- Layar Daftar/Lupa password: sesuaikan dengan alur undangan & reset admin-issued (P14).

## 8. Kriteria selesai F8

Akun baru (belum pernah ada) menyelesaikan wizard + tutorial **tanpa bantuan** dalam ≤ 10 menit (di luar menunggu email bank pertama) dan:
mencatat satu transaksi dari tiap jalur (manual, Shortcut, email forward), melihat saldo & budget hari ini benar, menerima satu pesan Telegram, dan checklist aktivasi hijau.
Rekam hasil uji (tanpa data pribadi) di Progress Log.
