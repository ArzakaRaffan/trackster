/**
 * Normalisasi deskripsi transaksi jadi kunci merchant yang stabil across varian toko —
 * "Kopi Kenangan 1320" & "Kopi Kenangan QR BRI 1 1" harus dapat kunci yang sama ("kopi kenangan").
 * Ambil 3 TOKEN PERTAMA dulu (bukan filter lalu ambil 3), baru buang token "qr"/angka murni/tanda
 * baca murni dari situ — biar sisipan kode pembayaran/bank di tengah nama toko (mis. "QR BRI") ikut
 * kepotong kalau posisinya masih di 3 kata pertama.
 * ponytail: heuristik posisi token, upgrade ke tabel mapping manual kalau banyak false-merge.
 */
export function merchantKey(description: string): string {
  const firstTokens = description.toLowerCase().trim().split(/\s+/).slice(0, 3);

  return firstTokens
    .map((token) => token.replace(/[^a-z]/g, ''))
    .filter((token) => token.length > 0 && token !== 'qr')
    .join(' ');
}
