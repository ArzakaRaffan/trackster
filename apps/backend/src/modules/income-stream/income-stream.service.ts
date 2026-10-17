import { Injectable, NotFoundException } from '@nestjs/common';
import { IncomeStatus } from '@prisma/client';
import { addWibDays, startOfWibDay, startOfWibWeek, wibDateKey } from '../../common/wib';
import { detectIncomeStreams } from './stream-detect';
import { PrismaService } from '../../prisma.service';
import { CreateIncomeStreamDto } from './dto/create-income-stream.dto';
import { UpdateIncomeStreamDto } from './dto/update-income-stream.dto';

@Injectable()
export class IncomeStreamService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: number, params: { activeOnly?: boolean } = {}) {
    return this.prisma.incomeStream.findMany({
      where: params.activeOnly ? { userId, isActive: true } : { userId },
      orderBy: { id: 'asc' },
    });
  }

  async create(userId: number, dto: CreateIncomeStreamDto) {
    const { linkPast, ...data } = dto;
    const stream = await this.prisma.incomeStream.create({ data: { ...data, userId } });
    const keywords = (data.matchKeywords ?? []).map((k) => k.trim()).filter(Boolean);
    if (linkPast && keywords.length) {
      const past = await this.prisma.income.findMany({
        where: {
          userId, streamId: null, status: IncomeStatus.CONFIRMED,
          receivedAt: { gte: addWibDays(startOfWibDay(new Date()), -200) },
          OR: keywords.map((k) => ({ description: { contains: k, mode: 'insensitive' as const } })),
        },
        select: { id: true, receivedAt: true },
      });
      // Sama dengan IncomeService.resolve: periodStart = Senin minggu diterima (dipakai histori forecast).
      for (const i of past) {
        await this.prisma.income.updateMany({ where: { id: i.id, userId }, data: { streamId: stream.id, periodStart: startOfWibWeek(i.receivedAt) } });
      }
    }
    return stream;
  }

  /** Saran sumber dari pemasukan rutin yang belum bersumber (200 hari terakhir). */
  async suggestions(userId: number) {
    const now = new Date();
    const [incomes, streams] = await Promise.all([
      this.prisma.income.findMany({
        where: { userId, streamId: null, status: IncomeStatus.CONFIRMED, receivedAt: { gte: addWibDays(startOfWibDay(now), -200) } },
        select: { description: true, amount: true, receivedAt: true, source: true },
      }),
      this.prisma.incomeStream.findMany({ where: { userId }, select: { name: true, matchKeywords: true } }),
    ]);
    return detectIncomeStreams(incomes.map((i) => ({ ...i, amount: Number(i.amount) })), streams, wibDateKey(now));
  }

  async update(userId: number, id: number, dto: UpdateIncomeStreamDto) {
    const { count } = await this.prisma.incomeStream.updateMany({ where: { id, userId }, data: dto });
    if (count === 0) throw new NotFoundException('Sumber pemasukan tidak ditemukan');
    return this.prisma.incomeStream.findFirstOrThrow({ where: { id, userId } });
  }

  async remove(userId: number, id: number) {
    const existing = await this.prisma.incomeStream.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Sumber pemasukan tidak ditemukan');
    await this.prisma.incomeStream.deleteMany({ where: { id, userId } });
    return existing;
  }
}
