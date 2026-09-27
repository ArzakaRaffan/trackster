import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';

const SCAN_SYSTEM_PROMPT = `Kamu membaca foto struk belanja/makan restoran. Ekstrak SEMUA baris item yang dibeli (nama item + harga satuan + jumlah), JANGAN sertakan baris subtotal/pajak/service charge/total/diskon sebagai item.

Jawab HANYA dengan JSON array valid, tanpa teks lain, tanpa markdown code fence, format persis:
[{"description": "Nama Item", "amount": 25000, "quantity": 1}, ...]

amount harus angka HARGA SATUAN (bukan total baris), dalam Rupiah tanpa titik/koma pemisah ribuan. quantity harus angka bulat jumlah item (kalau struk cuma nunjukin total baris tanpa quantity eksplisit, quantity = 1 dan amount = total baris itu). Kalau foto tidak terbaca/bukan struk, jawab dengan array kosong [].`;

interface ScannedItem {
  description: string;
  amount: number;
  quantity: number;
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

  async scanReceipt(imageBase64: string): Promise<ScannedItem[]> {
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
              { type: 'text', text: 'Ekstrak item dari struk ini.' },
            ],
          },
        ],
      }),
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

    const raw = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.error(`Scan receipt response bukan JSON valid: ${raw.slice(0, 300)}`);
      throw new BadRequestException('Struk tidak terbaca, coba foto ulang dengan pencahayaan lebih jelas');
    }

    if (!Array.isArray(parsed)) {
      throw new BadRequestException('Struk tidak terbaca, coba foto ulang dengan pencahayaan lebih jelas');
    }

    return parsed
      .filter((it): it is Record<string, unknown> => typeof it === 'object' && it !== null)
      .map((it) => ({
        description: String(it.description ?? '').trim(),
        amount: Number(it.amount),
        quantity: Number.isInteger(Number(it.quantity)) && Number(it.quantity) > 0 ? Number(it.quantity) : 1,
      }))
      .filter((it) => it.description.length > 0 && Number.isFinite(it.amount) && it.amount > 0);
  }
}
