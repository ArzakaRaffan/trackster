import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Trip, TripMember, TripExpense, TripExpenseShare } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { AddExpenseDto } from './dto/add-expense.dto';
import { settle, MemberBalance, Transfer } from './settle';

type MemberWithRelations = TripMember & {
  expensesPaid: TripExpense[];
  shares: TripExpenseShare[];
};

type ExpenseWithShares = TripExpense & { shares: TripExpenseShare[] };

type TripWithDetails = Trip & {
  members: MemberWithRelations[];
  expenses: ExpenseWithShares[];
};

@Injectable()
export class TripService {
  constructor(private prisma: PrismaService) {}

  private generateSlug(): string {
    return randomBytes(9).toString('base64url');
  }

  private memberBalances(trip: TripWithDetails): MemberBalance[] {
    const balances = new Map<number, number>();
    for (const m of trip.members) {
      balances.set(m.id, 0);
      // Sudah bayar = piutang (+)
      for (const e of m.expensesPaid) {
        balances.set(m.id, balances.get(m.id)! + Number(e.amount));
      }
    }

    for (const expense of trip.expenses) {
      const totalWeight = expense.shares.reduce((s, sh) => s + Number(sh.weight), 0);
      if (totalWeight <= 0) continue;
      const amount = Number(expense.amount);
      for (const sh of expense.shares) {
        const share = amount * (Number(sh.weight) / totalWeight);
        balances.set(sh.memberId, (balances.get(sh.memberId) || 0) - share);
      }
    }

    return trip.members.map((m) => ({
      memberId: m.id,
      name: m.name,
      net: balances.get(m.id) || 0,
    }));
  }

  private summary(trip: TripWithDetails) {
    const balances = this.memberBalances(trip);
    return {
      id: trip.id,
      publicSlug: trip.publicSlug,
      ownerToken: trip.ownerToken,
      name: trip.name,
      currency: trip.currency,
      createdAt: trip.createdAt,
      totalSpent: trip.expenses.reduce((s, e) => s + Number(e.amount), 0),
      members: trip.members.map((m) => ({ id: m.id, name: m.name })),
      expenses: trip.expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
        date: e.date,
        paidByMemberId: e.paidByMemberId,
        shares: e.shares.map((s) => ({ memberId: s.memberId, weight: Number(s.weight) })),
      })),
      balances,
      settlements: settle(balances),
    };
  }

  private async executeCreate(dto: CreateTripDto, userId: number | null, publicSlug: string, ownerToken: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const trip = await tx.trip.create({
        data: {
          publicSlug,
          ownerToken,
          name: dto.name,
          currency: dto.currency ?? 'IDR',
          createdByUserId: userId,
        },
      });

      const members: TripMember[] = [];
      for (const m of dto.members) {
        members.push(await tx.tripMember.create({ data: { tripId: trip.id, name: m.name } }));
      }

      for (const e of dto.expenses) {
        const paidBy = members[e.paidByMemberIndex ?? 0];
        if (!paidBy) continue;
        const expense = await tx.tripExpense.create({
          data: {
            tripId: trip.id,
            paidByMemberId: paidBy.id,
            amount: e.amount,
            description: e.description,
          },
        });

        const shares = e.shares && e.shares.length > 0 ? e.shares : [{ memberIndex: e.paidByMemberIndex ?? 0, weight: 1 }];
        for (const s of shares) {
          const member = members[s.memberIndex];
          if (member) {
            await tx.tripExpenseShare.create({
              data: { expenseId: expense.id, memberId: member.id, weight: s.weight },
            });
          }
        }
      }

      const created = await tx.trip.findUniqueOrThrow({
        where: { id: trip.id },
        include: {
          members: { include: { expensesPaid: true, shares: true } },
          expenses: { include: { shares: true } },
        },
      });
      return this.summary(created);
    });
  }

  async create(userId: number, dto: CreateTripDto) {
    return this.executeCreate(dto, userId, this.generateSlug(), null);
  }

  async createPublic(dto: CreateTripDto) {
    return this.executeCreate(dto, null, this.generateSlug(), this.generateSlug());
  }

  private async getTripWithDetailsOrThrow(slug: string): Promise<TripWithDetails> {
    const trip = await this.prisma.trip.findUnique({
      where: { publicSlug: slug },
      include: {
        members: { include: { expensesPaid: true, shares: true } },
        expenses: { include: { shares: true } },
      },
    });
    if (!trip) throw new NotFoundException('Trip tidak ditemukan');
    return trip;
  }

  private async getTripByOwnerTokenOrThrow(ownerToken: string): Promise<TripWithDetails> {
    const trip = await this.prisma.trip.findUnique({
      where: { ownerToken },
      include: {
        members: { include: { expensesPaid: true, shares: true } },
        expenses: { include: { shares: true } },
      },
    });
    if (!trip) throw new NotFoundException('Trip tidak ditemukan');
    return trip;
  }

  async findPublic(slug: string) {
    const s = this.summary(await this.getTripWithDetailsOrThrow(slug));
    // ownerToken = secret kelola, cuma buat pembuat trip. Jangan bocor ke link publik.
    const { ownerToken, ...rest } = s;
    return rest;
  }

  async findByOwnerToken(ownerToken: string) {
    return this.summary(await this.getTripByOwnerTokenOrThrow(ownerToken));
  }

  async addExpenseByOwnerToken(ownerToken: string, dto: AddExpenseDto) {
    const trip = await this.getTripByOwnerTokenOrThrow(ownerToken);
    const member = trip.members[dto.paidByMemberIndex];
    if (!member) throw new NotFoundException('Anggota pembayar tidak ditemukan');

    await this.prisma.$transaction(async (tx) => {
      const expense = await tx.tripExpense.create({
        data: {
          tripId: trip.id,
          paidByMemberId: member.id,
          amount: dto.amount,
          description: dto.description,
          date: dto.date ? new Date(dto.date) : undefined,
        },
      });

      const shares = dto.shares && dto.shares.length > 0 ? dto.shares : [{ memberIndex: dto.paidByMemberIndex, weight: 1 }];
      for (const s of shares) {
        const shareMember = trip.members[s.memberIndex];
        if (shareMember) {
          await tx.tripExpenseShare.create({
            data: { expenseId: expense.id, memberId: shareMember.id, weight: s.weight },
          });
        }
      }
    });

    return this.summary(await this.getTripByOwnerTokenOrThrow(ownerToken));
  }
}

export type { Transfer, MemberBalance };
