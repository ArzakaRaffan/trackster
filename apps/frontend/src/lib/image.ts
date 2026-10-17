/**
 * Kecilkan foto (data URL) sebelum upload: sisi terpanjang ≤ maxDim, JPEG. Foto HP mentah 3–12 MB → ±200–500 KB,
 * jauh lebih cepat di jaringan seluler dan muat di batas body backend (6 MB). Teks struk tetap terbaca di 1600px.
 * Gagal decode (format aneh) → data URL asli dikembalikan apa adanya.
 */
export async function shrinkDataUrl(dataUrl: string, maxDim = 1600, quality = 0.8): Promise<string> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.fillStyle = '#fff'; // PNG transparan → latar putih, bukan hitam
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/jpeg', quality);
    return out.length < dataUrl.length ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}
