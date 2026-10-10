import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma, SplitBillItem, SplitBillParticipant, SplitBillItemShare, SplitBill } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { CreateSplitBillDto } from './dto/create-split-bill.dto';
import { AssignSharesDto } from './dto/assign-shares.dto';
import { calculate, ParticipantResult } from './split-calc';

type ItemWithShares = SplitBillItem & { shares: SplitBillItemShare[] };
type BillWithDetails = SplitBill & { participants: SplitBillParticipant[], items: ItemWithShares[] };

export interface ParticipantTotal extends ParticipantResult {
  name: string;
  avatar: string | null;
  isPaid: boolean;
  paidAt: Date | null;
}

@Injectable()
export class SplitBillService {
  constructor(private prisma: PrismaService) {}

  private generateSlug(): string {
    return randomBytes(9).toString('base64url');
  }

  calculateTotals(bill: BillWithDetails): ParticipantTotal[] {
    const input = {
      items: bill.items.map(i => ({
        id: i.id,
        price: Number(i.amount),
        qty: i.quantity,
        shares: i.shares.map(s => ({ participantId: s.participantId, weight: Number(s.weight) }))
      })),
      participants: bill.participants.map(p => ({ id: p.id, name: p.name })),
      taxPercent: bill.taxPercent ? Number(bill.taxPercent) : 0,
      taxAmount: bill.taxAmount ? Number(bill.taxAmount) : 0,
      servicePercent: bill.servicePercent ? Number(bill.servicePercent) : 0,
      serviceAmount: bill.serviceFeeAmount ? Number(bill.serviceFeeAmount) : 0,
      discountAmount: bill.discountAmount ? Number(bill.discountAmount) : 0,
      discountPercent: bill.discountPercent ? Number(bill.discountPercent) : 0,
      deliveryFee: bill.deliveryFee ? Number(bill.deliveryFee) : 0,
      roundingUnit: bill.roundingUnit as any,
      taxAfterService: bill.taxAfterService,
    };

    const calcResult = calculate(input);

    return calcResult.participants.map(r => {
      const p = bill.participants.find(x => x.id === r.participantId)!;
      return {
        ...r,
        name: p.name,
        avatar: p.avatar,
        isPaid: p.isPaid,
        paidAt: p.paidAt,
      };
    });
  }

  private async executeCreate(dto: CreateSplitBillDto, userId: number | null, publicSlug: string, ownerToken: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.splitBill.create({
        data: {
          publicSlug,
          ownerToken,
          createdByUserId: userId,
          restaurantName: dto.restaurantName,
          billDate: new Date(dto.billDate),
          taxAmount: dto.taxAmount ?? 0,
          serviceFeeAmount: dto.serviceFeeAmount ?? 0,
          taxPercent: dto.taxPercent ?? 0,
          servicePercent: dto.servicePercent ?? 0,
          discountAmount: dto.discountAmount ?? 0,
          discountPercent: dto.discountPercent ?? 0,
          deliveryFee: dto.deliveryFee ?? 0,
          roundingUnit: dto.roundingUnit ?? 0,
          taxAfterService: dto.taxAfterService ?? false,
          payerBankName: dto.payerBankName,
          payerAccountNumber: dto.payerAccountNumber,
          payerAccountName: dto.payerAccountName,
        },
      });

      const participants: SplitBillParticipant[] = [];
      for (const p of dto.participants) {
        participants.push(
          await tx.splitBillParticipant.create({
            data: { splitBillId: bill.id, name: p.name, avatar: p.avatar },
          })
        );
      }

      const items: ItemWithShares[] = [];
      for (const i of dto.items) {
        const item = await tx.splitBillItem.create({
          data: {
            splitBillId: bill.id,
            description: i.description,
            amount: i.amount,
            quantity: i.quantity ?? 1,
          }
        });

        const shares: any[] = [];
        if (i.shares && i.shares.length > 0) {
          for (const s of i.shares) {
            // `shares` tak divalidasi DTO (bentuk bebas dari endpoint publik): indeks & bobot dicek manual.
            const p = Number.isInteger(s?.participantIndex) ? participants[s.participantIndex] : undefined;
            if (p && typeof s.weight === 'number' && s.weight > 0 && s.weight <= 1000) {
              const share = await tx.splitBillItemShare.create({
                data: {
                  itemId: item.id,
                  participantId: p.id,
                  weight: s.weight,
                }
              });
              shares.push(share);
            }
          }
        }
        items.push({ ...item, shares });
      }

      return { ...bill, participants, items };
    });
  }

  async create(userId: number, dto: CreateSplitBillDto) {
    return this.executeCreate(dto, userId, this.generateSlug(), null);
  }

  async createPublic(dto: CreateSplitBillDto) {
    return this.executeCreate(dto, null, this.generateSlug(), this.generateSlug());
  }

  async findAllForUser(userId: number) {
    return this.prisma.splitBill.findMany({
      where: { createdByUserId: userId },
      orderBy: { billDate: 'desc' },
      include: { participants: true, items: { include: { shares: true } } },
    });
  }

  private async getOwnedBillOrThrow(id: number, userId: number) {
    const bill = await this.prisma.splitBill.findUnique({
      where: { id },
      include: { participants: true, items: { include: { shares: true } } },
    });
    if (!bill) throw new NotFoundException('Split bill tidak ditemukan');
    if (bill.createdByUserId !== userId) throw new ForbiddenException('Bukan split bill kamu');
    return bill;
  }

  async findOneDetail(id: number, userId: number) {
    const bill = await this.getOwnedBillOrThrow(id, userId);
    const totals = this.calculateTotals(bill);
    return { ...bill, participantTotals: totals };
  }

  private async assignSharesToBill(billId: number, itemId: number, sharesDto: AssignSharesDto) {
    const item = await this.prisma.splitBillItem.findUnique({ where: { id: itemId } });
    if (!item || item.splitBillId !== billId) throw new NotFoundException('Item tidak ditemukan');

    for (const s of sharesDto.shares) {
      const participant = await this.prisma.splitBillParticipant.findUnique({ where: { id: s.participantId } });
      if (!participant || participant.splitBillId !== billId) {
        throw new NotFoundException('Participant tidak ditemukan');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.splitBillItemShare.deleteMany({ where: { itemId } });
      for (const s of sharesDto.shares) {
        await tx.splitBillItemShare.create({
          data: {
            itemId,
            participantId: s.participantId,
            weight: s.weight,
          }
        });
      }
      return tx.splitBillItem.findUnique({
        where: { id: itemId },
        include: { shares: true }
      });
    });
  }

  async assignShares(billId: number, itemId: number, userId: number, dto: AssignSharesDto) {
    await this.getOwnedBillOrThrow(billId, userId);
    return this.assignSharesToBill(billId, itemId, dto);
  }

  private async getBillByOwnerTokenOrThrow(ownerToken: string) {
    const bill = await this.prisma.splitBill.findUnique({
      where: { ownerToken },
      include: { participants: true, items: { include: { shares: true } } },
    });
    if (!bill) throw new NotFoundException('Split bill tidak ditemukan');
    return bill;
  }

  async findOneByOwnerToken(ownerToken: string) {
    const bill = await this.getBillByOwnerTokenOrThrow(ownerToken);
    const totals = this.calculateTotals(bill);
    return { ...bill, participantTotals: totals };
  }

  async assignSharesByOwnerToken(ownerToken: string, itemId: number, dto: AssignSharesDto) {
    const bill = await this.getBillByOwnerTokenOrThrow(ownerToken);
    return this.assignSharesToBill(bill.id, itemId, dto);
  }

  async getPublicSummary(slug: string) {
    const bill = await this.prisma.splitBill.findUnique({
      where: { publicSlug: slug },
      include: { participants: true, items: { include: { shares: true } } },
    });
    if (!bill) throw new NotFoundException('Split bill tidak ditemukan');

    const totals = this.calculateTotals(bill);

    return {
      restaurantName: bill.restaurantName,
      billDate: bill.billDate,
      taxAmount: bill.taxAmount,
      serviceFeeAmount: bill.serviceFeeAmount,
      taxPercent: bill.taxPercent,
      servicePercent: bill.servicePercent,
      discountAmount: bill.discountAmount,
      discountPercent: bill.discountPercent,
      deliveryFee: bill.deliveryFee,
      roundingUnit: bill.roundingUnit,
      taxAfterService: bill.taxAfterService,
      payerBankName: bill.payerBankName,
      payerAccountNumber: bill.payerAccountNumber,
      payerAccountName: bill.payerAccountName,
      items: bill.items.map((i) => ({
        id: i.id,
        description: i.description,
        amount: i.amount,
        quantity: i.quantity,
        shares: i.shares,
      })),
      participants: totals,
    };
  }

  /** Ganti avatar peserta lewat link publik — sama tingkat kepercayaannya dengan togglePaidPublic (siapa pun yang punya link). */
  async setAvatarPublic(slug: string, participantId: number, avatar: string) {
    const bill = await this.prisma.splitBill.findUnique({ where: { publicSlug: slug } });
    if (!bill) throw new NotFoundException('Split bill tidak ditemukan');
    const { count } = await this.prisma.splitBillParticipant.updateMany({ where: { id: participantId, splitBillId: bill.id }, data: { avatar } });
    if (!count) throw new NotFoundException('Participant tidak ditemukan');
    return { participantId, avatar };
  }

  async togglePaidPublic(slug: string, participantId: number) {
    const bill = await this.prisma.splitBill.findUnique({ where: { publicSlug: slug } });
    if (!bill) throw new NotFoundException('Split bill tidak ditemukan');

    const participant = await this.prisma.splitBillParticipant.findUnique({ where: { id: participantId } });
    if (!participant || participant.splitBillId !== bill.id) {
      throw new NotFoundException('Participant tidak ditemukan');
    }

    const nextIsPaid = !participant.isPaid;
    return this.prisma.splitBillParticipant.update({
      where: { id: participantId },
      data: { isPaid: nextIsPaid, paidAt: nextIsPaid ? new Date() : null },
    });
  }
}
