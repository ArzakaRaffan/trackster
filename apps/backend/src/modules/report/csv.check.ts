// npx ts-node src/modules/report/csv.check.ts — sel CSV tidak boleh jadi formula spreadsheet.
import { strictEqual } from 'assert';
import { csvText } from './report.controller';

strictEqual(csvText('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
strictEqual(csvText('+62'), `"'+62"`);
strictEqual(csvText('-5'), `"'-5"`);
strictEqual(csvText('@SUM(A1)'), `"'@SUM(A1)"`);
strictEqual(csvText('\tx'), `"'\tx"`);
strictEqual(csvText('KOPI "A"'), `"KOPI ""A"""`);
strictEqual(csvText(''), `""`);
console.log('csv.check OK');
