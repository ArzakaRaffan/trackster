// Uji parser bank OFFLINE dengan email asli (.eml), lewat jalur teks yang sama dengan inbound (mailBodyText) — tanpa DB/backend.
// Cara dapat .eml: di Gmail buka email notifikasi bank → ⋮ → "Download message". JANGAN commit .eml asli (repo publik).
//
//   npx ts-node -T scripts/parse-eml.ts email1.eml [email2.eml ...] [--name "NAMA DI REKENING"] [--acc 1234567890,0987...]
//   npx ts-node -T scripts/parse-eml.ts email.eml --fixture src/modules/gmail/parsers/__fixtures__/mandiri-xxx.txt
//     --fixture menulis teks body yang sudah DISAMARKAN (angka ≥6 digit diganti, --redact "Nama Asli,Nama Lain") untuk parsers.check.ts.
//     Tetap baca ulang fixture sebelum commit: nama merchant/penerima pribadi harus diganti manual.
import { readFileSync, writeFileSync } from 'node:fs';
import { simpleParser } from 'mailparser';
import { mailBodyText } from '../src/modules/inbound/inbound.util';
import { ParserRegistryService } from '../src/modules/gmail/parsers/parser-registry.service';
import { BcaParser } from '../src/modules/gmail/parsers/bca.parser';
import { JagoParser } from '../src/modules/gmail/parsers/jago.parser';
import { FlipParser } from '../src/modules/gmail/parsers/flip.parser';
import { BniParser } from '../src/modules/gmail/parsers/bni.parser';
import { MandiriParser } from '../src/modules/gmail/parsers/mandiri.parser';
import { RayaParser } from '../src/modules/gmail/parsers/raya.parser';
import { BriParser } from '../src/modules/gmail/parsers/bri.parser';

const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const valued = new Set(['--name', '--acc', '--fixture', '--redact']);
const files = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]));
if (!files.length) { console.error('Pakai: npx ts-node -T scripts/parse-eml.ts file.eml [...] [--name ..] [--acc ..] [--fixture out.txt --redact "a,b"]'); process.exit(1); }

const ctx = { fullName: opt('--name') ?? '', accounts: (opt('--acc') ?? '').split(',').map((x) => x.replace(/\D/g, '')).filter(Boolean) };
const registry = new ParserRegistryService(new BcaParser(), new JagoParser(), new FlipParser(), new BniParser(), new MandiriParser(), new RayaParser(), new BriParser());

/** Samarkan: angka ≥6 digit (rekening/ref) -> digit urut sepanjang aslinya; string --redact -> "Nama Contoh". */
function anonymize(text: string): string {
  let out = text.replace(/\d{6,}/g, (m) => '1234567890'.repeat(3).slice(0, m.length));
  for (const r of (opt('--redact') ?? '').split(',').map((x) => x.trim()).filter(Boolean)) out = out.split(r).join('Nama Contoh');
  return out;
}

(async () => {
  let fail = 0;
  for (const f of files) {
    const raw = readFileSync(f);
    const mail = await simpleParser(raw);
    const email = { id: 'eml', from: mail.from?.text ?? '', subject: mail.subject ?? '', body: mailBodyText(raw, mail), internalDate: String((mail.date ?? new Date()).getTime()) };
    const { parser, result } = registry.parseEmailWithSource(email, ctx);
    const status = !registry.canHandle(email) ? 'DIBUANG (pengirim bukan bank)' : !result ? 'UNPARSED (parser ' + parser + ' tidak mengenali format)' : result.excluded ? 'EXCLUDED' : 'RECORDED';
    if (!result) fail++;
    console.log(`\n== ${f}\nfrom: ${email.from}\nsubject: ${email.subject}\nstatus: ${status}`);
    if (result) console.log(result);
    else console.log('--- teks body (yang dibaca parser) ---\n' + email.body.slice(0, 1500));
    const fx = opt('--fixture');
    if (fx && files.length === 1) { writeFileSync(fx, anonymize(email.body)); console.log(`fixture ditulis (disamarkan): ${fx} — BACA ULANG sebelum commit`); }
  }
  process.exitCode = fail ? 1 : 0;
})();
