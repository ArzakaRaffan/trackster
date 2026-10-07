import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReimbursementStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { BalanceService, shouldAdjustBalance } from '../balance/balance.service';
import { CreateReimbursementDto } from './dto/create-reimbursement.dto';
import { MarkReceivedDto } from './dto/mark-received.dto';

@Injectable()
export class ReimbursementService {
  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
  ) {}

  /** Piutang: default cuma PENDING, lengkap dengan transaksi asalnya. Dengan `transactionId`: semua status transaksi itu. */
  list(userId: number, status: ReimbursementStatus = 'PENDING', transactionId?: number) {
    return this.prisma.reimbursement.findMany({
      where: transactionId ? { userId, transactionId } : { userId, status },
      include: { transaction: { select: { id: true, description: true, amount: true, occurredAt: true, source: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Dicatat PENDING — belum ngubah pengeluaran maupun saldo. */
  async create(userId: number, dto: CreateReimbursementDto) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id: dto.transactionId, userId },
      include: { reimbursements: { select: { amount: true } } },
    });
    if (!tx) throw new NotFoundException('Transaksi tidak ditemukan');
    const claimed = tx.reimbursements.reduce((s, r) => s + Number(r.amount), 0);
    if (claimed + dto.amount > Number(tx.amount)) {
      throw new BadRequestException(
        `Total patungan (${claimed + dto.amount}) melebihi nominal transaksi (${Number(tx.amount)})`,
      );
    }
    return this.prisma.reimbursement.create({
      data: { userId, transactionId: dto.transactionId, personName: dto.personName.trim(), amount: dto.amount },
    });
  }

  /** Uang patungan masuk: kurangi pengeluaran efektif transaksi + tambah saldo (dalam 1 db tx). */
  async markReceived(userId: number, id: number, dto: MarkReceivedDto) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.reimbursement.findFirst({ where: { id, userId }, include: { transaction: true } });
      if (!r) throw new NotFoundException('Patungan tidak ditemukan');
      if (r.status === 'RECEIVED') throw new BadRequestException('Patungan sudah ditandai diterima');

      const source = dto.source ?? r.transaction.source;
      const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
      const lastAdjustmentAt = await this.balanceService.getLastManualAdjustmentAt(tx, userId, source);
      const balanceApplied = shouldAdjustBalance(receivedAt, lastAdjustmentAt);

      await tx.transaction.updateMany({
        where: { id: r.transactionId, userId },
        data: { reimbursedAmount: { increment: r.amount } },
      });
      if (balanceApplied) await this.balanceService.adjustBalance(tx, userId, source, Number(r.amount));

      await tx.reimbursement.updateMany({
        where: { id, userId },
        data: { status: 'RECEIVED', receivedAt, receivedSource: source, balanceApplied },
      });
      return tx.reimbursement.findFirstOrThrow({ where: { id, userId } });
    });
  }

  /** Hapus patungan. Kalau sudah RECEIVED, efek ke pengeluaran & saldo dibalikkan persis. */
  async remove(userId: number, id: number) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.reimbursement.findFirst({ where: { id, userId } });
      if (!r) throw new NotFoundException('Patungan tidak ditemukan');
      if (r.status === 'RECEIVED') {
        await tx.transaction.updateMany({
          where: { id: r.transactionId, userId },
          data: { reimbursedAmount: { decrement: r.amount } },
        });
        if (r.balanceApplied && r.receivedSource) {
          await this.balanceService.adjustBalance(tx, userId, r.receivedSource, -Number(r.amount));
        }
      }
      await tx.reimbursement.deleteMany({ where: { id, userId } });
      return r;
    });
  }
}
