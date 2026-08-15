import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { BalanceService } from '../balance/balance.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';

@Injectable()
export class IncomeService {
  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
  ) {}

  async findAll(params: { startDate?: string; endDate?: string }) {
    const { startDate, endDate } = params;
    const where: Prisma.IncomeWhereInput = {};
    if (startDate || endDate) {
      where.receivedAt = {};
      if (startDate) where.receivedAt.gte = new Date(startDate);
      if (endDate) where.receivedAt.lte = new Date(endDate);
    }
    return this.prisma.income.findMany({ where, orderBy: { receivedAt: 'desc' } });
  }

  async create(dto: CreateIncomeDto) {
    return this.prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          amount: dto.amount,
          description: dto.description,
          source: dto.source,
          receivedAt: new Date(dto.receivedAt),
        },
      });
      await this.balanceService.adjustBalance(tx, income.source, Number(income.amount));
      return income;
    });
  }

  /** Reverse efek balance dari data lama dulu, baru apply data baru — lebih simpel & aman
   * daripada ngitung selisih per-field, dan tetap benar walau amount dan source dua-duanya berubah. */
  async update(id: number, dto: UpdateIncomeDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.income.findUniqueOrThrow({ where: { id } });
      await this.balanceService.adjustBalance(tx, existing.source, -Number(existing.amount));

      const updated = await tx.income.update({
        where: { id },
        data: {
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.source !== undefined && { source: dto.source }),
          ...(dto.receivedAt !== undefined && { receivedAt: new Date(dto.receivedAt) }),
        },
      });
      await this.balanceService.adjustBalance(tx, updated.source, Number(updated.amount));
      return updated;
    });
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.income.delete({ where: { id } });
      await this.balanceService.adjustBalance(tx, deleted.source, -Number(deleted.amount));
      return deleted;
    });
  }
}
