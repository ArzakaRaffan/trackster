# Riset: Bisakah Pemasukan Tercatat Otomatis?

> Jawaban untuk permintaan #2. Diriset 2026-09-24 (inbox Gmail Arzaka + web). Implementasi: [E02](../epics/E02-income-auto-capture.md).

## TL;DR

| Jalur | Bisa? | Biaya | Keandalan | Rekomendasi |
|---|---|---|---|---|
| Email dana masuk **Jago** | ✅ **Sudah ada di inbox**, belum di-parse | Gratis | Tinggi | **Kerjakan duluan (E02-S1)** |
| Email dana masuk **BCA** | ❌ Tidak ada | — | — | Sesuai temuan lama, tetap tidak ada |
| Notifikasi push myBCA/BCA mobile → **iOS 27 Shortcuts** | ✅ Kemungkinan besar (fitur baru iOS 27) | Gratis | Sedang (perlu dites di HP) | **Eksperimen (E02-S2)** |
| Check-in pemasukan mingguan (tanya lewat Telegram, 1 tap) | ✅ | Gratis | Tinggi (manusia yang konfirmasi) | **Jaring pengaman (E03-S3)** |
| Moota / Mutasibank (robot login internet banking) | ✅ | ±Rp72rb/bulan/rekening | Tinggi, delay ~15 menit | Tidak sekarang |
| Parse e-Statement BCA bulanan (PDF) | ✅ secara teori | Gratis | Telat sebulan | Tidak sekarang |

**Strategi yang disarankan:** kombinasi 3 lapis — (1) arahkan pembayar rutin (ortu buat uang mingguan,
murid les, tempat magang) transfer ke **Jago** → otomatis tercatat dari email; (2) kalau HP sudah iOS 27,
Shortcut nangkep notifikasi dana masuk myBCA; (3) sisanya ditangkap check-in mingguan yang tahu jadwal
pemasukan kamu (E03) — cukup tap "✅ masuk" / ubah nominal.

## 1. BCA: memang tidak ada email dana masuk

- Setting notifikasi email myBCA membagi notifikasi "finansial" (transfer, bayar tagihan, top-up, QRIS)
  dan "non-finansial". Artikel yang membahasnya tidak pernah menyebut email untuk **dana masuk**
  ([Kontan](https://momsmoney.kontan.co.id/news/tips-praktis-atur-notifikasi-email-mybca-biar-transaksi-aman-dan-enggak-ribet),
  [Tribun Batam](https://batam.tribunnews.com/bisnis/680509/cara-mengaktifkan-notifikasi-email-di-mybca-bisa-diatur-sesuai-kebutuhan)).
- Edukatips BCA (Juni 2026) menyebut notifikasi transaksi di BCA mobile mencakup "semua transaksi masuk
  dan keluar", tapi dalam bentuk **notifikasi aplikasi (push)**, bukan email
  ([bca.co.id](https://www.bca.co.id/en/informasi/edukatips/2026/06/19/14/11/langkah-mudah-mengatur-notifikasi-di-bca-mobile)).
- Ini cocok dengan temuan lama di `CLAUDE.md` (BCA tidak pernah kirim email dana masuk).
- Inbox Arzaka (180 hari, `from:bca`): hanya "Internet Transaction Journal" (transaksi keluar), notifikasi
  login/device, dan promo. Tidak ada satupun email dana masuk.

## 2. Jago: SUDAH mengirim email dana masuk (belum dimanfaatkan)

Contoh nyata (`1a03cc97a1b07d5c`, 26 Agu 2026):

```
From:    noreply@jago.com
Subject: Asik, kamu telah menerima sejumlah uang💰

Kantong Jago-mu telah menerima sejumlah uang dan berikut rinciannya:
| Ringkasan transaksi |
| Dari              | FLIPTECH LENTERA INSPIRASI PERTIWI Permata Bank • 7027730927 |
| Ke                | MA • 105602544330 |
| Jumlah            | Rp112.500 |
| Tanggal transaksi | 26 August 2026 13:37 WIB |
```

Catatan penting:
- Dua email yang ditemukan dua-duanya **Dari FLIPTECH** = kemungkinan besar Arzaka sendiri top-up
  BCA → Jago lewat Flip (internal, bukan pemasukan). Tapi orang lain yang kirim via Flip juga akan
  muncul sebagai "FLIPTECH". Jadi aturan exclude-nya harus **korelasi** dengan transfer BCA→FLIPTECH
  yang nominalnya mirip di sekitar waktu yang sama (lihat E02-S1), bukan sekadar nama pengirim.
- Transfer langsung dari rekening orang lain akan menampilkan nama pengirim asli → bisa dicocokkan ke
  sumber pemasukan (mis. nama ortu → "Uang mingguan", nama wali murid → "Les privat").

## 3. iPhone: iOS 27 akhirnya punya trigger "Notification" di Shortcuts

Dulu (iOS ≤ 26) memang tidak bisa: Shortcuts tidak punya trigger untuk notifikasi aplikasi; yang ada cuma
trigger Message/Email dan App dibuka/ditutup.

Di **iOS 27** (WWDC26), Shortcuts dapat automation baru **"Notification"**: jalan saat notifikasi dari
aplikasi tertentu masuk, bisa difilter berdasarkan title/subtitle/message, dan isi notifikasi tersedia
sebagai variabel `Notification` (body text, tanggal) untuk diproses lebih lanjut
([MacStories iOS 27 review](https://www.macstories.net/stories/ios-and-ipados-27-review/13/),
[WWDC26 What's new in Shortcuts](https://developer.apple.com/videos/play/wwdc2026/310/)).

Artinya alur ini **mungkin**:
```
Push myBCA "Dana masuk Rp400.000 dari ..." 
  → Automation "Notification" (App: myBCA, filter message berisi "masuk")
  → Action "Get Contents of URL" POST https://api.track.trackster.my.id/income/ingest
      headers: X-Ingest-Token: <secret>
      body: { text: <Notification body>, app: "myBCA", at: <date> }
  → backend parse teks → Income (status perlu konfirmasi kalau parse ragu)
```

Yang **belum pasti** dan harus dites di HP Arzaka sebelum koding penuh:
- HP sudah iOS 27? (fitur ini tidak ada di iOS 26)
- Automation jalan otomatis tanpa perlu tap konfirmasi? (Sejak iOS 17 personal automation bisa "Run Immediately",
  tapi perilaku trigger baru ini belum terdokumentasi jelas untuk kondisi HP terkunci.)
- Format teks notifikasi myBCA/BCA mobile untuk dana masuk (apakah ada nominal + nama pengirim di body,
  atau cuma "Ada transaksi masuk, cek aplikasi").
- Notifikasi aplikasi bank kadang disembunyikan isinya kalau "Show Previews: When Unlocked" → perlu diset
  "Always" untuk myBCA.

→ Makanya E02-S2 dimulai dengan **eksperimen 15 menit di HP** (Shortcut yang cuma kirim teks mentah
notifikasi ke endpoint log), baru parser dibuat berdasarkan contoh teks asli.

## 4. Layanan cek mutasi (Moota, Mutasibank)

- Robot yang login ke internet banking secara berkala, baca mutasi, kirim webhook JSON untuk tiap mutasi baru
  ([moota.co](https://moota.co/), [panduan webhook](https://moota.co/moota-luncurkan-pembaruan-terbaru-fitur-webhook-untuk-mempermudah-integrasi-dan-pengelolaan-data-mutasi-bank/),
  [mutasibank.co.id](https://mutasibank.co.id/mutasi-bca-otomatis)).
- Harga BCA Individu di Moota: **Rp2.400/hari ≈ Rp72rb/bulan per rekening**
  ([Moota BCA Individu](https://moota.co/moota-luncurkan-fitur-baru-bca-individu/)). Cek mutasi ±15 menit sekali.
- Harus menyerahkan kredensial KlikBCA ke pihak ketiga.
- Untuk pemasukan Arzaka (±Rp1,3jt/minggu), Rp72rb/bulan ≈ 1,4% pemasukan + risiko kredensial.
  **Tidak direkomendasikan sekarang**; simpan sebagai opsi kalau 3 lapis di atas terbukti gagal.

## 5. e-Statement BCA

BCA mengirim e-Statement bulanan (PDF berpassword) yang memuat mutasi masuk. Bisa di-parse untuk
**rekonsiliasi** akhir bulan ("ada Rp X masuk yang belum tercatat"), tapi telat sampai sebulan → tidak
membantu saran budget mingguan. Parkir; mungkin berguna nanti sebagai fitur "cek selisih bulanan".

## Keputusan

1. E02-S1: parser email Jago dana masuk + korelasi FLIPTECH. (Pasti jalan, gratis.)
2. E03-S3: check-in mingguan berbasis jadwal pemasukan. (Pasti jalan, jaring pengaman.)
3. E02-S2: eksperimen iOS 27 Notification → endpoint ingest. (Kalau HP belum iOS 27 atau notifikasi
   tidak memuat nominal → berhenti di eksperimen, catat hasilnya di sini.)
4. Tidak pakai Moota / e-Statement untuk sekarang.
