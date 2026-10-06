import { Injectable } from '@nestjs/common';
import { BcaParser } from './bca.parser';
import { JagoParser } from './jago.parser';
import { FlipParser } from './flip.parser';
import { BniParser } from './bni.parser';
import { MandiriParser } from './mandiri.parser';
import { RayaParser } from './raya.parser';
import { BriParser } from './bri.parser';
import { OwnerContext } from './own-accounts';
import { EmailParser, RawEmail, ParseResult } from './parser.interface';

@Injectable()
export class ParserRegistryService {
  private parsers: Array<{ name: string; parser: EmailParser }>;

  constructor(bcaParser: BcaParser, jagoParser: JagoParser, flipParser: FlipParser, bniParser: BniParser, mandiriParser: MandiriParser, rayaParser: RayaParser, briParser: BriParser) {
    // Flip dulu: email Flip jangan ke-handle BCA/Jago by accident
    this.parsers = [
      { name: 'flip', parser: flipParser },
      { name: 'bca', parser: bcaParser },
      { name: 'jago', parser: jagoParser },
      { name: 'bni', parser: bniParser },
      { name: 'mandiri', parser: mandiriParser },
      { name: 'raya', parser: rayaParser },
      { name: 'bri', parser: briParser },
    ];
  }

  parseEmail(email: RawEmail, ctx: OwnerContext): ParseResult | null {
    return this.parseEmailWithSource(email, ctx).result;
  }

  /** Sama seperti parseEmail, tapi juga bilang parser mana yang match — dipakai EmailParseLog. */
  parseEmailWithSource(email: RawEmail, ctx: OwnerContext): { parser: string | null; result: ParseResult | null } {
    for (const { name, parser } of this.parsers) {
      if (parser.canHandle(email)) {
        return { parser: name, result: parser.parse(email, ctx) };
      }
    }
    return { parser: null, result: null };
  }
}
