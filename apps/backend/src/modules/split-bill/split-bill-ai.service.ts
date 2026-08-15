import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';

const SCAN_SYSTEM_PROMPT = `Kamu membaca foto struk belanja/makan restoran. Ekstrak SEMUA baris item yang dibeli (nama item + harga), JANGAN sertakan baris subtotal/pajak/service charge/total/diskon sebagai item.

Jawab HANYA dengan JSON array valid, tanpa teks lain, tanpa markdown code fence, format persis:
[{"description": "Nama Item", "amount": 25000}, ...]

amount harus angka (bukan string), dalam Rupiah tanpa titik/koma pemisah ribuan. Kalau foto tidak terbaca/bukan struk, jawab dengan array kosong [].`;

interface ScannedItem {
  description: string;
  amount: number;
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
    const baseUrl = process.env.SPLITBILL_AI_BASE_URL || 'https://api.mwapi.dev';
    const apiKey = process.env.SPLITBILL_AI_API_KEY;
    const model = process.env.SPLITBILL_AI_MODEL || 'claude-sonnet-5';

    if (!apiKey) {
      throw new InternalServerErrorException('SPLITBILL_AI_API_KEY belum di-set di environment');
    }

    const { mediaType, data } = this.parseImageInput(imageBase64);

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: SCAN_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
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
    const textBlock = responseData.content?.find((c: any) => c.type === 'text');
    if (!textBlock?.text) {
      throw new InternalServerErrorException('Response scan struk tidak berisi teks yang valid');
    }

    const raw = textBlock.text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();

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
      .filter((it): it is { description: unknown; amount: unknown } => typeof it === 'object' && it !== null)
      .map((it) => ({ description: String((it as any).description ?? '').trim(), amount: Number((it as any).amount) }))
      .filter((it) => it.description.length > 0 && Number.isFinite(it.amount) && it.amount > 0);
  }
}
