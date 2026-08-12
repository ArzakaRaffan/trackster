import { Injectable } from '@nestjs/common';
import { BcaParser } from './bca.parser';
import { JagoParser } from './jago.parser';
import { EmailParser, RawEmail, ParseResult } from './parser.interface';

@Injectable()
export class ParserRegistryService {
  private parsers: EmailParser[];

  constructor(bcaParser: BcaParser, jagoParser: JagoParser) {
    this.parsers = [bcaParser, jagoParser];
    // GoPay sengaja tidak didaftarkan (out of scope, lihat build plan)
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
