import { Injectable } from '@nestjs/common';
import { BcaParser } from './bca.parser';
import { JagoParser } from './jago.parser';
import { FlipParser } from './flip.parser';
import { EmailParser, RawEmail, ParseResult } from './parser.interface';

@Injectable()
export class ParserRegistryService {
  private parsers: Array<{ name: string; parser: EmailParser }>;

  constructor(bcaParser: BcaParser, jagoParser: JagoParser, flipParser: FlipParser) {
    // Flip dulu: email Flip jangan ke-handle BCA/Jago by accident
    this.parsers = [
      { name: 'flip', parser: flipParser },
      { name: 'bca', parser: bcaParser },
      { name: 'jago', parser: jagoParser },
    ];
  }

  parseEmail(email: RawEmail): ParseResult | null {
    return this.parseEmailWithSource(email).result;
  }

  /** Sama seperti parseEmail, tapi juga bilang parser mana yang match — dipakai EmailParseLog. */
  parseEmailWithSource(email: RawEmail): { parser: string | null; result: ParseResult | null } {
    for (const { name, parser } of this.parsers) {
      if (parser.canHandle(email)) {
        return { parser: name, result: parser.parse(email) };
      }
    }
    return { parser: null, result: null };
  }
}
