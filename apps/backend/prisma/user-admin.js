// CLI admin user (plain JS: jalan di container prod tanpa ts-node; hanya folder `prisma/` + `dist/` yang ada di image).
//   node prisma/user-admin.js invite --for "Nama"        cetak URL undangan sekali pakai (kedaluwarsa 7 hari)
//   node prisma/user-admin.js reset --username <u>        cetak URL reset password sekali pakai (24 jam)
//   node prisma/user-admin.js list
//   node prisma/user-admin.js inbound --username <u> [--shadow on|off] [--rotate]   buat/lihat alamat email-forward (u-<acak>@in.trackster.dev)
//   node prisma/user-admin.js disable|enable --username <u>
// Hanya HASH kode/token yang disimpan; URL dicetak sekali di sini. Kirim ke user lewat kanal pribadi.
// Catatan: backend menyimpan status user di cache ≤30 dtk, jadi `disable` efektif paling lama 30 dtk kemudian.
const { PrismaClient } = require('@prisma/client');
const { createHash, randomBytes } = require('crypto');

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const arg = (name) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : undefined; };
const base = (process.env.FRONTEND_URL || 'https://trackster.dev').replace(/\/$/, '');
// 15 byte acak (120 bit) -> 24 karakter base32 huruf kecil (a-z2-7); cocok dengan parseLocalPart di backend.
const b32 = () => { let bits = '', out = ''; for (const b of randomBytes(15)) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += 'abcdefghijklmnopqrstuvwxyz234567'[parseInt(bits.slice(i, i + 5), 2)]; return out; };
const inboundDomain = process.env.INBOUND_DOMAIN || 'in.trackster.dev';
const DAY = 24 * 60 * 60 * 1000;

async function main(prisma) {
  const cmd = process.argv[2];
  if (cmd === 'list') {
    const users = await prisma.user.findMany({ orderBy: { id: 'asc' }, select: { id: true, username: true, role: true, status: true, createdAt: true, lastLoginAt: true } });
    console.table(users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString().slice(0, 10), lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 16) : '-' })));
  } else if (cmd === 'invite') {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' }, orderBy: { id: 'asc' }, select: { id: true } });
    if (!admin) throw new Error('Tidak ada user ADMIN aktif');
    const code = 'inv_' + randomBytes(24).toString('base64url');
    await prisma.invite.create({ data: { codeHash: sha256(code), createdByUserId: admin.id, forUsernameHint: arg('for') || null, expiresAt: new Date(Date.now() + 7 * DAY) } });
    console.log(`Undangan${arg('for') ? ' untuk ' + arg('for') : ''} (berlaku 7 hari, sekali pakai):\n${base}/invite/${code}`);
  } else if (cmd === 'inbound') {
    const username = arg('username');
    if (!username) throw new Error('--username wajib');
    const user = await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } });
    if (!user) throw new Error('User tidak ditemukan');
    const shadow = arg('shadow');
    if (shadow && !['on', 'off'].includes(shadow)) throw new Error('--shadow harus on|off');
    const existing = await prisma.inboundAddress.findUnique({ where: { userId: user.id } });
    const data = { ...(shadow ? { shadow: shadow === 'on' } : {}), ...(process.argv.includes('--rotate') ? { localPart: b32(), rotatedAt: new Date(), forwardVerifiedAt: null } : {}) };
    const addr = existing
      ? (Object.keys(data).length ? await prisma.inboundAddress.update({ where: { id: existing.id }, data }) : existing)
      : await prisma.inboundAddress.create({ data: { userId: user.id, localPart: b32(), shadow: shadow === 'on' } });
    console.log(`${user.username}: u-${addr.localPart}@${inboundDomain}  (shadow=${addr.shadow}, aktif=${addr.isActive}, terverifikasi=${addr.forwardVerifiedAt ? 'ya' : 'belum'})`);
  } else if (cmd === 'reset' || cmd === 'disable' || cmd === 'enable') {
    const username = arg('username');
    if (!username) throw new Error('--username wajib');
    const user = await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } });
    if (!user) throw new Error('User tidak ditemukan');
    if (cmd === 'reset') {
      const token = 'rst_' + randomBytes(24).toString('base64url');
      await prisma.oneTimeToken.create({ data: { userId: user.id, kind: 'RESET_PASSWORD', tokenHash: sha256(token), expiresAt: new Date(Date.now() + DAY) } });
      console.log(`Tautan reset untuk ${user.username} (berlaku 24 jam, sekali pakai):\n${base}/reset/${token}`);
    } else {
      await prisma.user.update({ where: { id: user.id }, data: cmd === 'disable' ? { status: 'DISABLED', tokenVersion: { increment: 1 } } : { status: 'ACTIVE' } });
      console.log(`${user.username}: ${cmd === 'disable' ? 'DISABLED (semua sesi dicabut)' : 'ACTIVE'}`);
    }
  } else {
    console.log('Perintah: invite --for "Nama" | reset --username u | list | inbound --username u [--shadow on|off] [--rotate] | disable|enable --username u');
    process.exitCode = 1;
  }
}

const prisma = new PrismaClient();
main(prisma).catch((e) => { console.error('Gagal:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
