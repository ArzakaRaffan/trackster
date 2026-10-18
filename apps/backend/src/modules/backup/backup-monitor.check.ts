/** Self-check: `npm run check -- backup-monitor` — peringatan backup basi/tidak ada, diam kalau segar. */
import * as assert from 'assert';
import { backupAlert } from './backup-monitor.service';

const now = Date.UTC(2026, 9, 18, 2); // 09:00 WIB
const h = (n: number) => now - n * 3600_000;
assert.match(backupAlert([], now)!, /belum ada backup harian/);
assert.match(backupAlert([{ name: 'trackster-predeploy-1.dump', mtimeMs: h(1) }], now)!, /belum ada/, 'predeploy tidak dihitung harian');
assert.strictEqual(backupAlert([{ name: 'trackster-daily-a.dump', mtimeMs: h(6) }], now), null, 'backup 03:00 WIB tadi = segar');
assert.match(backupAlert([{ name: 'trackster-daily-a.dump', mtimeMs: h(30) }, { name: 'trackster-daily-b.dump', mtimeMs: h(54) }], now)!, /30 jam lalu/);
assert.strictEqual(backupAlert([{ name: 'trackster-daily-a.dump.tmp', mtimeMs: h(1) }, { name: 'trackster-daily-b.dump', mtimeMs: h(20) }], now), null, '.tmp diabaikan');
console.log('backup-monitor.check OK');
