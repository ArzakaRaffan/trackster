import { Injectable } from '@nestjs/common';
import { BcaParser } from './bca.parser';
import { JagoParser } from './jago.parser';
import { FlipParser } from './flip.parser';
import { EmailParser, RawEmail, ParseResult } from './parser.interface';

@Injectable()
export class ParserRegistryService {
  private parsers: EmailParser[];

  constructor(bcaParser: BcaParser, jagoParser: JagoParser, flipParser: FlipParser) {
    // Flip dulu: email Flip jangan ke-handle BCA/Jago by accident
    this.parsers = [flipParser, bcaParser, jagoParser];
  }

  parseEmail(email: RawEmail): ParseResult | null {
    for (const parser of this.parsers) {
      if (parser.canHandle(email)) {
        return parser.parse(email);
      }
    }
    return null;
  }
}
