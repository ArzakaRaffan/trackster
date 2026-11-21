import * as assert from 'assert';
import { parseScanText } from './split-bill-ai.service';

// Format baru lengkap, dibungkus code fence, diskon negatif → positif.
const r1 = parseScanText('```json\n{"items":[{"description":"Nasi Goreng","amount":35000,"quantity":2},{"description":"","amount":5000}],"subtotal":70000,"tax":7000,"service":"3500","discount":-10000}\n```');
assert.deepStrictEqual(r1, { items: [{ description: 'Nasi Goreng', amount: 35000, quantity: 2 }], subtotal: 70000, tax: 7000, service: 3500, discount: 10000 });

// Format lama (array saja) tetap jalan; biaya 0; quantity aneh → 1; amount 0 dibuang.
const r2 = parseScanText('[{"description":"Es Teh","amount":8000,"quantity":1.5},{"description":"Gratis","amount":0}]');
assert.deepStrictEqual(r2, { items: [{ description: 'Es Teh', amount: 8000, quantity: 1 }], subtotal: 0, tax: 0, service: 0, discount: 0 });

// Biaya hilang / bukan angka → 0.
assert.deepStrictEqual(parseScanText('{"items":[],"tax":"abc"}'), { items: [], subtotal: 0, tax: 0, service: 0, discount: 0 });

// Bukan JSON / bentuk salah → null (controller balas 400).
assert.strictEqual(parseScanText('Maaf, saya tidak bisa membaca struk ini.'), null);
assert.strictEqual(parseScanText('{"total":5000}'), null);
assert.strictEqual(parseScanText('null'), null);

console.log('split-scan checks OK');
