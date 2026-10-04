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
  list(status: ReimbursementStatus = 'PENDING', transactionId?: number) {
    return this.prisma.reimbursement.findMany({
      where: transactionId ? { transactionId } : { status },
      include: { transaction: { select: { id: true, description: true, amount: true, occurredAt: true, source: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Dicatat PENDING — belum ngubah pengeluaran maupun saldo. */
  async create(dto: CreateReimbursementDto) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId },
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
      data: { transactionId: dto.transactionId, personName: dto.personName.trim(), amount: dto.amount },
    });
  }

  /** Uang patungan masuk: kurangi pengeluaran efektif transaksi + tambah saldo (dalam 1 db tx). */
  async markReceived(id: number, dto: MarkReceivedDto) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.reimbursement.findUnique({ where: { id }, include: { transaction: true } });
      if (!r) throw new NotFoundException('Patungan tidak ditemukan');
      if (r.status === 'RECEIVED') throw new BadRequestException('Patungan sudah ditandai diterima');

      const source = dto.source ?? r.transaction.source;
      const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
      const lastAdjustmentAt = await this.balanceService.getLastManualAdjustmentAt(tx, source);
      const balanceApplied = shouldAdjustBalance(receivedAt, lastAdjustmentAt);

      await tx.transaction.update({
        where: { id: r.transactionId },
        data: { reimbursedAmount: { increment: r.amount } },
      });
      if (balanceApplied) await this.balanceService.adjustBalance(tx, source, Number(r.amount));

      return tx.reimbursement.update({
        where: { id },
        data: { status: 'RECEIVED', receivedAt, receivedSource: source, balanceApplied },
      });
    });
  }

  /** Hapus patungan. Kalau sudah RECEIVED, efek ke pengeluaran & saldo dibalikkan persis. */
  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.reimbursement.findUnique({ where: { id } });
      if (!r) throw new NotFoundException('Patungan tidak ditemukan');
      if (r.status === 'RECEIVED') {
        await tx.transaction.update({
          where: { id: r.transactionId },
          data: { reimbursedAmount: { decrement: r.amount } },
        });
        if (r.balanceApplied && r.receivedSource) {
          await this.balanceService.adjustBalance(tx, r.receivedSource, -Number(r.amount));
        }
      }
      return tx.reimbursement.delete({ where: { id } });
    });
  }
}
