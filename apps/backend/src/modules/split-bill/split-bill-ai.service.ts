import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';

const SCAN_SYSTEM_PROMPT = `Kamu membaca foto struk belanja/makan restoran. Foto bisa miring, buram, kusut, atau terpotong — baca sebisanya.

Ekstrak SEMUA baris item yang dibeli (nama item + harga satuan + jumlah). Baris subtotal/pajak/PB1/PPN/service charge/total/diskon/promo/pembulatan/tunai/kembalian BUKAN item.

Jawab HANYA dengan JSON object valid, tanpa teks lain, tanpa markdown code fence, format persis:
{"items": [{"description": "Nama Item", "amount": 25000, "quantity": 1}], "subtotal": 0, "tax": 0, "service": 0, "discount": 0}

- amount = HARGA SATUAN (bukan total baris), Rupiah tanpa pemisah ribuan. quantity = jumlah bulat (kalau tidak tertulis, quantity = 1 dan amount = total baris).
- subtotal = angka subtotal yang tercetak di struk (sebelum pajak/service), 0 kalau tidak ada.
- tax = total NOMINAL pajak (PB1/PPN/tax) dalam Rupiah, service = total nominal service charge, discount = total nominal diskon/promo sebagai angka POSITIF. Kalau struk cuma menulis persen tanpa nominal, hitung nominalnya dari subtotal. 0 kalau tidak ada.
- Kalau foto tidak terbaca/bukan struk: {"items": [], "subtotal": 0, "tax": 0, "service": 0, "discount": 0}.`;

export interface ScannedItem {
  description: string;
  amount: number;
  quantity: number;
}

export interface ScanResult {
  items: ScannedItem[];
  subtotal: number;
  tax: number;
  service: number;
  discount: number;
}

const money = (v: unknown) => {
  const n = Math.abs(Number(v)); // diskon kadang ditulis negatif oleh model
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/** Respons teks model → hasil scan. `null` = bukan JSON. Format lama (array item saja) tetap diterima. */
export function parseScanText(text: string): ScanResult | null {
  const raw = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const obj = (Array.isArray(parsed) ? { items: parsed } : parsed) as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.items)) return null;
  const items = obj.items
    .filter((it): it is Record<string, unknown> => typeof it === 'object' && it !== null)
    .map((it) => ({
      description: String(it.description ?? '').trim(),
      amount: Number(it.amount),
      quantity: Number.isInteger(Number(it.quantity)) && Number(it.quantity) > 0 ? Number(it.quantity) : 1,
    }))
    .filter((it) => it.description.length > 0 && Number.isFinite(it.amount) && it.amount > 0);
  return { items, subtotal: money(obj.subtotal), tax: money(obj.tax), service: money(obj.service), discount: money(obj.discount) };
}

@Injectable()
export class SplitBillAiService {
  private readonly logger = new Logger(SplitBillAiService.name);

  private parseImageInput(imageBase64: string): { mediaType: string; data: string } {
    const dataUrlMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (dataUrlMatch) {
      return { mediaType: dataUrlMatch[1], data: dataUrlMatch[2] };
    }
    return { mediaType: 'image/jpeg', data: imageBase64 };
  }

  async scanReceipt(imageBase64: string): Promise<ScanResult> {
    // 9router (self-hosted, OpenAI-compatible) — dari container, host-nya diakses via
    // host.docker.internal (lihat extra_hosts di docker-compose.prod.yml).
    const baseUrl = process.env.SPLITBILL_AI_BASE_URL || 'http://host.docker.internal:20128';
    const apiKey = process.env.SPLITBILL_AI_API_KEY;
    const model = process.env.SPLITBILL_AI_MODEL || 'cc/claude-sonnet-5';

    if (!apiKey) {
      throw new InternalServerErrorException('SPLITBILL_AI_API_KEY belum di-set di environment');
    }

    const { mediaType, data } = this.parseImageInput(imageBase64);

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false, // 9router default streaming kalau nggak eksplisit false — lihat ai.service.ts
        max_tokens: 2048,
        messages: [
          { role: 'system', content: SCAN_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mediaType};base64,${data}` } },
              { type: 'text', text: 'Ekstrak item dan biaya dari struk ini.' },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(60_000), // model vision macet → gagal jelas, bukan menggantung
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      this.logger.error(`Scan receipt AI error ${res.status}: ${errText}`);
      throw new InternalServerErrorException(`Gagal scan struk (HTTP ${res.status})`);
    }

    const responseData = await res.json();
    const text: string | undefined = responseData.choices?.[0]?.message?.content;
    if (!text) {
      throw new InternalServerErrorException('Response scan struk tidak berisi teks yang valid');
    }

    const scan = parseScanText(text);
    if (!scan) {
      this.logger.error(`Scan receipt response bukan JSON valid: ${text.slice(0, 300)}`);
      throw new BadRequestException('Struk tidak terbaca, coba foto ulang dengan pencahayaan lebih jelas');
    }
    return scan;

  }
}
