import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { InboundService } from './inbound.service';

/** Dipanggil Cloudflare Email Worker. Auth = HMAC (bukan JWT/cookie). Body = raw MIME (parser raw dipasang di main.ts untuk path ini). */
@Controller('ingest')
export class InboundController {
  constructor(private inbound: InboundService) {}

  @Post('email')
  @HttpCode(200)
  email(
    @Req() req: any,
    @Headers('x-trackster-to') to?: string,
    @Headers('x-trackster-timestamp') timestamp?: string,
    @Headers('x-trackster-signature') signature?: string,
  ) {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new BadRequestException('Body kosong');
    return this.inbound.handle(req.body, { to, timestamp, signature });
  }
}
