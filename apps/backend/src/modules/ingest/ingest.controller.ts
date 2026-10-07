import { BadRequestException, Body, Controller, Headers, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../../common/guards/api-token.guard';
import { isValidIdempotencyKey } from '../api-token/api-token.util';
import { IngestService } from './ingest.service';
import { IngestIncomeDto, IngestTransactionDto } from './dto/ingest.dto';

const needKey = (k: string | undefined): string => {
  if (!isValidIdempotencyKey(k)) throw new BadRequestException('Header Idempotency-Key wajib (8–100 karakter: huruf/angka/._:-, mis. UUID)');
  return k;
};

/** Auth = Bearer ApiToken (bukan cookie JWT). Dibalas 201 saat dicatat, 200 + duplicate:true saat kunci sudah pernah dipakai. */
@Controller('ingest')
@UseGuards(ApiTokenGuard)
export class IngestController {
  constructor(private ingest: IngestService) {}

  @Post('transaction')
  @HttpCode(201)
  async transaction(@Req() req: any, @Res({ passthrough: true }) res: any, @Headers('idempotency-key') key: string | undefined, @Body() dto: IngestTransactionDto) {
    const out = await this.ingest.ingestTransaction(req.apiAuth.userId, needKey(key), dto);
    if (out.duplicate) res.status(200);
    return out;
  }

  @Post('income')
  @HttpCode(201)
  async income(@Req() req: any, @Res({ passthrough: true }) res: any, @Headers('idempotency-key') key: string | undefined, @Body() dto: IngestIncomeDto) {
    const out = await this.ingest.ingestIncome(req.apiAuth.userId, needKey(key), dto);
    if (out.duplicate) res.status(200);
    return out;
  }
}
