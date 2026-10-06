// CLI admin user (plain JS: jalan di container prod tanpa ts-node; hanya folder `prisma/` + `dist/` yang ada di image).
//   node prisma/user-admin.js invite --for "Nama"        cetak URL undangan sekali pakai (kedaluwarsa 7 hari)
//   node prisma/user-admin.js reset --username <u>        cetak URL reset password sekali pakai (24 jam)
//   node prisma/user-admin.js list
//   node prisma/user-admin.js disable|enable --username <u>
// Hanya HASH kode/token yang disimpan; URL dicetak sekali di sini. Kirim ke user lewat kanal pribadi.
// Catatan: backend menyimpan status user di cache ≤30 dtk, jadi `disable` efektif paling lama 30 dtk kemudian.
const { PrismaClient } = require('@prisma/client');
const { createHash, randomBytes } = require('crypto');

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const arg = (name) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : undefined; };
const base = (process.env.FRONTEND_URL || 'https://trackster.dev').replace(/\/$/, '');
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
    console.log('Perintah: invite --for "Nama" | reset --username u | list | disable|enable --username u');
    process.exitCode = 1;
  }
}

const prisma = new PrismaClient();
main(prisma).catch((e) => { console.error('Gagal:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
