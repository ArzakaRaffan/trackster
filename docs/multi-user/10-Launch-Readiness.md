# 10 — Kesiapan Peluncuran Multi-User (audit 2026-10-13)

Cara audit: DB scratch baru (`trackster_launch`, semua migrasi), akun admin dari seed + **akun tester baru lewat undangan**
(`user-admin.js invite`), lalu semua layar `/app/*` dan `/demo/*` dijalankan di browser dalam bahasa ID dan EN. Teks diambil
langsung dari DOM, bukan ditebak dari kode.

## A. Hal yang masih terasa "app pribadi Arzaka"

### A1. Pemblokir (tester tidak bisa memakai app dengan benar)
| # | Temuan | Bukti | Status |
|---|---|---|---|
| 1 | Tidak ada cara user mengisi **nama di rekening** & **nomor rekening sendiri** (`User.fullName`, `OwnAccount`). Tanpa itu parser tidak mengenali transfer ke rekening sendiri → tercatat sebagai pengeluaran. Hanya pemilik yang punya fallback env `OWNER_*`. | `grep ownAccount` = hanya dibaca, tidak ada endpoint tulis | diperbaiki (lihat C) |
| 2 | Setelah daftar, user langsung masuk `/app` — **wizard tidak pernah muncul**. Wizard `/setup` 100% simulasi (kode Gmail palsu muncul 2,4 dtk, transaksi uji palsu, alamat `kamu-k3j9x@in.trackster.my.id` domain lama). | uji daftar via undangan | diperbaiki (C) |
| 3 | Setting → Koneksi menampilkan **"Hubungkan Google"** ke semua user, padahal Gmail OAuth owner-only (403 untuk tester). Sumber data: "Gmail belum terhubung… Hubungkan di Setting → Koneksi" = jalan buntu. | layar Setting & Sumber data akun tester | diperbaiki (C) |
| 4 | Alamat forwarding tidak pernah ditampilkan ke user (hanya CLI admin `user-admin.js inbound`). | — | diperbaiki (C) |
| 5 | Lupa password: toast "minta tautan reset ke **Arzaka**". | `logic.tsx` `sendReset` | diperbaiki (E) |

### A2. Asumsi hidup Arzaka di produk
| # | Temuan | Catatan |
|---|---|---|
| 6 | Bank default **BCA + Jago** (+Flip) untuk semua user: `provisionUser` membuat saldo BCA/JAGO, beranda menampilkan chip BCA/Jago/Flip "menunggu". | Sebaiknya dari pilihan bank di wizard. Diperbaiki: wizard menyimpan bank pilihan. |
| 7 | Jenis pemasukan dirancang dari hidup Arzaka: "per sesi (les privat)", "potongan absen (magang)", "variabel (Ruangguru)". | Tetap berguna sebagai opsi; label UI sudah umum. Tidak diubah. |
| 8 | Kategori `ROKOK`, `PERAWATAN` sebagai kategori bawaan. | Netral, dibiarkan. |
| 9 | Langganan menjanjikan "reminder Calendar" — Calendar owner-only (P11/O9 belum diputuskan). | Teks diubah agar tidak menjanjikan Calendar ke tester. |
| 10 | Prompt AI: persona "konsultan pribadi Arzaka" diganti nama user lewat `forUser()` — fungsional, tapi AI **selalu menjawab Bahasa Indonesia** walau UI EN. | Diperbaiki (F). |
| 11 | Semua jadwal cron & batas hari = **WIB** (P5). | Keputusan sadar v1, dibiarkan. |
| 12 | Kontak di `/privacy` & `/terms` = email pribadi Arzaka. | Perlu email support (O4). Tidak diubah tanpa keputusan. |
| 13 | Landing/harga: "Coba gratis", **Plus**, "Tanpa kartu kredit", daftar tunggu, "Masuk Google" — semua tampilan tanpa backend; ada kalimat "Harga… adalah contoh untuk desain, belum final" yang terlihat publik. | Keputusan produk (harga/pembayaran). Lihat §G. |
| 14 | Data contoh prototipe (rekening `5271038841`, nama "Arzaka Raffan", memory "les privat") hanya di `/demo` — tidak bocor ke live. | Aman. |

## B. Bug tersembunyi yang ditemukan
| # | Bug | Status |
|---|---|---|
| B1 | Branch `feat/multi-user` (kode inbound P7-04) tertinggal dari `main` 20+ commit: konflik `package.json` (lib Telegram sudah dihapus di main), `main.ts` (header keamanan). | digabung di `feat/multi-user-launch` |
| B2 | `dist/` + `tsconfig.tsbuildinfo` basi → `nest start` gagal "Cannot find module ./modules/auth/auth.module" (gotcha lama, masih terjadi). | dicatat; hapus keduanya sebelum start |
| B3 | Layar `/`, `/login`, `/setup` merender dashboard di belakangnya (teks dashboard ada di DOM). | dicatat, tidak berdampak visual |

## C. Wizard & profil (perbaikan, 2026-10-13)
- Backend `modules/profile` (P8-01). Wizard `/setup` nyata (P8-02): akun baru diarahkan otomatis, nama/rekening/bank disimpan,
  alamat penerusan asli, kode konfirmasi Gmail & email bank pertama muncul sendiri (poll), filter Gmail sesuai bank, progres dari server.
- Setting → Koneksi: Email bank (alamat + status) dan Nama & rekening untuk semua user; Gmail hanya pemilik. Saldo bank: semua bank user.
- Diuji: akun undangan baru → wizard → `send-eml.mjs --gmail-confirm` (kode muncul) → `.eml` BCA tiruan (tercatat, sisa hari ini turun) → selesai → `/app`.

## D. Forwarding email — cara menguji (jawaban "bingung tesnya gimana")
Tiga tingkat, dari yang tidak butuh DNS sampai end-to-end nyata:

1. **Lokal, email sintetis** (sudah ada): `node scripts/inbound-e2e.mjs` — 11 skenario (HMAC salah, replay, alamat asing, dedup, non-bank dibuang, isolasi A/B, shadow, konfirmasi Gmail, >3MB).
2. **Lokal, email bank ASLI** (baru): di Gmail buka email notifikasi bank → ⋮ → *Download message* (`.eml`). Lalu
   `node scripts/send-eml.mjs --file contoh.eml --to u-xxxx@in.trackster.dev` (backend lokal, secret sama dengan `INGEST_HMAC_SECRET`).
   Ini menguji parser terhadap format MIME asli tanpa Cloudflare. File `.eml` asli **jangan di-commit** (repo publik).
3. **End-to-end nyata** (butuh P7-02/P7-03 — DNS ke Cloudflare, ⛔ izin Arzaka per langkah): deploy Worker `infra/cloudflare-worker/`,
   aktifkan Email Routing `in.trackster.dev` catch-all → Worker, lalu dari Gmail tambahkan alamat penerusan → kode konfirmasi muncul di
   wizard langkah 4 → buat filter → kirim email uji. Mulai dengan alamat Arzaka `shadow=on` (P3) agar tidak dobel dengan Gmail sync.

## E. Copywriting
Prinsip penulisan ulang: kalimat pendek, kata kerja jelas, tanpa janji yang belum benar, tanpa gaya "AI"
(personifikasi berlebihan, "kami tangkap untukmu", "financial buddy", "sisanya urusan Trackster", tanda pisah dramatis).
Daftar perubahan ada di diff commit `copy:`.

## F. Ganti bahasa
Cara kerja: `v3tr()` menerjemahkan **node teks DOM** lewat kamus (1.137 entri) + beberapa regex. Akibatnya:
- Teks dinamis (berisi angka/nama) tidak terjemah kecuali ada regex-nya. Sisa ID yang ditemukan (akun kosong + demo):
  "7 hari terakhir", "dari perkiraan RpX", "Masuk RpX · Keluar RpY", "vs minggu lalu", "N dari 7 hari over", "Tercatat RpX",
  "Total terkumpul di", "Target <tgl>", "N hari lagi", "Bulanan · BCA · …", "Aktif (", "Nonaktif (", "aktif", "menunggu",
  "LANGKAH N DARI 7", "Gmail belum terhubung…", kategori di baris transaksi ("Makanan", "Transport"), "ketuk untuk tandai rutin",
  "dari N orang", "N belum bayar", "untuk mencapai RpX dalam N bulan", "bulan", "KURANG", "TERCATAT", "AKTIF", "MENUNGGU", "2 jam lalu".
- Di luar app v3 tidak ada pilihan bahasa: `/invite`, `/reset`, tools publik lama, `/privacy`, `/terms`.
- Jawaban AI, pesan Telegram, dan pesan error dari backend selalu ID.

## G. Butuh keputusan Arzaka (tidak dikerjakan tanpa jawaban)
1. **Harga/Plus & pembayaran**: tetap gratis selama tester? Sembunyikan halaman Harga sampai ada pembayaran?
2. **Email kontak/support** untuk privacy/terms & "lupa password" (O4).
3. **O6** bank yang dipakai tester (parser BNI/Mandiri/BRI/Raya belum pernah diuji email asli).
4. **DNS Cloudflare** (P7-02) — langkah per langkah dengan izin.
5. **O9** reminder langganan untuk tester (Telegram atau tidak ada).
