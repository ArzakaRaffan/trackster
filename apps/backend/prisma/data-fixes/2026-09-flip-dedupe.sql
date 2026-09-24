-- 2026-09-flip-dedupe.sql
-- Perbaikan data prod E01-S3: parser Flip lama (sebelum fix) menyimpan email instruksi
-- "Transaction information..." sebagai transaksi terpisah (dobel dengan receipt aslinya), dan
-- deskripsi receipt bocor CSS mentah karena htmlToText belum strip <style> (fixed di E01-S1/S2).
-- Dicek manual lewat Gmail + query read-only ke prod sebelum menulis script ini (2026-09-24).
--
-- Jalankan manual sekali: docker exec -i trackster-postgres-1 psql -U trackster -d trackster < ini
-- WAJIB backup dulu: docker exec trackster-postgres-1 pg_dump -U trackster trackster > ~/backup-$(date +%F-%H%M).sql
--
-- id 162 & 164: email "Transaction information..." (instruksi bayar ke rekening Flip), BUKAN
-- transaksi nyata — uang baru betulan keluar saat SoF BCA kepotong ke Flip, yang mana sudah
-- di-exclude dari sisi parser BCA (FLIPTECH). Saldo BCA sudah di-rebaseline manual 2026-09-22
-- 03:20:34 UTC (BalanceAdjustment id 5, "Penyesuaian Baru"), jadi hapus TANPA mengembalikan
-- saldo — angka saldo saat ini sudah benar tanpa transaksi ini.
DELETE FROM "Transaction" WHERE id = 162 AND "emailId" = '1a0bf2bbf135bd29';
DELETE FROM "Transaction" WHERE id = 164 AND "emailId" = '1a0b9eddb3b43bf1';

-- id 161 & 163: receipt asli (expense final), deskripsi diperbaiki dari isi email (dicek langsung
-- di Gmail), format mengikuti FlipParser baru: "<Destination Name> · <Bank> …<4 digit rekening>".
UPDATE "Transaction" SET description = 'Ahmad Dzulfikar As Shavy · BNI …0567'
  WHERE id = 161 AND "emailId" = '1a0bf2c74c1d60d7';
UPDATE "Transaction" SET description = 'REYHANI INTAN SABRIN · Mandiri …2442'
  WHERE id = 163 AND "emailId" = '1a0b9eeadc20846a';
