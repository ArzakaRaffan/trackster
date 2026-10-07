import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { invalidateAuthCache } from '../../common/guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';

// Plain JS (dipakai juga seed/CLI tanpa ts-node); di dist menunjuk /app/prisma.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { provisionUser } = require('../../../prisma/provision-user');

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const FAIL_WINDOW_MS = 60_000;
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);
const FAIL_LIMIT = 10; // gagal login per username per menit sebelum ditolak sementara (selain throttler per-IP)

@Injectable()
export class AuthService {
  // ponytail: in-memory (satu proses backend); pindah ke tabel/Redis bila di-scale.
  private fails = new Map<string, { n: number; since: number }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private sign(user: { id: number; username: string; tokenVersion: number }) {
    return this.jwtService.signAsync(
      { sub: user.id, username: user.username, tv: user.tokenVersion },
      { secret: process.env.JWT_SECRET, expiresIn: '7d' },
    );
  }

  private checkFails(key: string) {
    const f = this.fails.get(key);
    if (f && Date.now() - f.since < FAIL_WINDOW_MS && f.n >= FAIL_LIMIT) {
      throw new HttpException('Terlalu banyak percobaan. Coba lagi sebentar.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private noteFail(key: string) {
    const f = this.fails.get(key);
    if (!f || Date.now() - f.since >= FAIL_WINDOW_MS) this.fails.set(key, { n: 1, since: Date.now() });
    else f.n++;
  }

  async validateAndLogin(username: string, password: string) {
    const key = username.trim().toLowerCase();
    this.checkFails(key);
    // Username tidak peka huruf besar-kecil (data lama bisa bercampur huruf).
    const user = await this.prisma.user.findFirst({ where: { username: { equals: key, mode: 'insensitive' } } });
    // Selalu bandingkan hash (hash palsu bila user tak ada) agar waktu respons tak membocorkan keberadaan username.
    const ok = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
    if (!user || !ok || user.status !== 'ACTIVE') {
      this.noteFail(key);
      throw new UnauthorizedException('Username atau password salah');
    }
    this.fails.delete(key);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { token: await this.sign(user), user: { id: user.id, username: user.username } };
  }

  /** Daftar lewat kode undangan sekali pakai. Semua dalam satu transaksi: user, data awal, penandaan kode. */
  async register(dto: RegisterDto) {
    const max = Number(process.env.MAX_USERS) || 10;
    const code = sha256(dto.inviteCode.trim());
    const user = await this.prisma.$transaction(async (tx) => {
      const invite = await tx.invite.findUnique({ where: { codeHash: code } });
      if (!invite || invite.usedAt || invite.expiresAt < new Date()) throw new BadRequestException('Kode undangan tidak valid atau sudah kedaluwarsa');
      if ((await tx.user.count()) >= max) throw new ForbiddenException('Kuota pengguna penuh');
      if (await tx.user.findFirst({ where: { username: { equals: dto.username, mode: 'insensitive' } }, select: { id: true } })) {
        throw new ConflictException('Username sudah dipakai');
      }
      const created = await tx.user.create({
        data: { username: dto.username, password: await bcrypt.hash(dto.password, 10), displayName: dto.displayName?.trim() || dto.username, role: 'MEMBER' },
      });
      // updateMany + usedAt:null = klaim atomik: dua pendaftar dengan kode yang sama → hanya satu yang lolos.
      const claimed = await tx.invite.updateMany({ where: { id: invite.id, usedAt: null }, data: { usedAt: new Date(), usedByUserId: created.id } });
      if (claimed.count !== 1) throw new BadRequestException('Kode undangan tidak valid atau sudah kedaluwarsa');
      await provisionUser(tx, created.id);
      return created;
    });
    return { token: await this.sign(user), user: { id: user.id, username: user.username } };
  }

  /** Ganti password: sesi lain mati (tokenVersion naik), sesi ini diberi token baru. */
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) throw new UnauthorizedException('Password saat ini salah');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(newPassword, 10), tokenVersion: { increment: 1 } },
    });
    invalidateAuthCache(userId);
    return { token: await this.sign(updated) };
  }

  /** Reset lewat token sekali pakai buatan admin (CLI). Tidak login otomatis. */
  async resetPassword(token: string, newPassword: string) {
    const hash = sha256(token.trim());
    const userId = await this.prisma.$transaction(async (tx) => {
      const row = await tx.oneTimeToken.findUnique({ where: { tokenHash: hash } });
      if (!row || row.kind !== 'RESET_PASSWORD' || row.usedAt || row.expiresAt < new Date()) throw new BadRequestException('Tautan reset tidak valid atau sudah kedaluwarsa');
      const claimed = await tx.oneTimeToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new BadRequestException('Tautan reset tidak valid atau sudah kedaluwarsa');
      await tx.user.update({ where: { id: row.userId }, data: { password: await bcrypt.hash(newPassword, 10), tokenVersion: { increment: 1 } } });
      return row.userId;
    });
    invalidateAuthCache(userId);
  }

  /** Keluar di semua perangkat (termasuk yang ini). */
  async logoutAll(userId: number) {
    await this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    invalidateAuthCache(userId);
  }

  async getUserById(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return { id: user.id, username: user.username, displayName: user.displayName ?? user.username, role: user.role, onboardedAt: user.onboardedAt };
  }
}
