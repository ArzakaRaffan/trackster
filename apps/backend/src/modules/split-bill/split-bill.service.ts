import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma, SplitBillItem, SplitBillParticipant } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { CreateSplitBillDto } from './dto/create-split-bill.dto';

type ParticipantWithItems = SplitBillParticipant & { items: SplitBillItem[] };

export interface ParticipantTotal {
  id: number;
  name: string;
  isPaid: boolean;
  paidAt: Date | null;
  itemsTotal: number;
  taxShare: number;
  serviceFeeShare: number;
  totalOwed: number;
}

@Injectable()
export class SplitBillService {
  constructor(private prisma: PrismaService) {}

  /** publicSlug harus unguessable (dipakai sebagai satu-satunya "kunci" akses link publik). */
  private generateSlug(): string {
    return randomBytes(9).toString('base64url');
  }

  /** Kalkulasi per-participant on-the-fly — TIDAK disimpan sebagai kolom statis karena
   * assignment item bisa berubah-ubah sebelum bill final. Dipanggil dari endpoint
   * authenticated (detail) maupun publik (share link), jadi harus reusable & pure. */
  calculateTotals(
    participants: ParticipantWithItems[],
    taxAmount: Prisma.Decimal | number,
    serviceFeeAmount: Prisma.Decimal | number,
  ): ParticipantTotal[] {
    const participantCount = participants.length || 1;
    const tax = Number(taxAmount);
    const serviceFee = Number(serviceFeeAmount);
    const taxShare = tax / participantCount;
    const serviceFeeShare = serviceFee / participantCount;

    return participants.map((p) => {
      const itemsTotal = p.items.reduce((sum, item) => sum + Number(item.amount) * item.quantity, 0);
      return {
        id: p.id,
        name: p.name,
        isPaid: p.isPaid,
        paidAt: p.paidAt,
        itemsTotal,
        taxShare,
        serviceFeeShare,
        totalOwed: itemsTotal + taxShare + serviceFeeShare,
      };
    });
  }

  async create(userId: number, dto: CreateSplitBillDto) {
    return this.prisma.splitBill.create({
      data: {
        publicSlug: this.generateSlug(),
        restaurantName: dto.restaurantName,
        billDate: new Date(dto.billDate),
        taxAmount: dto.taxAmount ?? 0,
        serviceFeeAmount: dto.serviceFeeAmount ?? 0,
        payerBankName: dto.payerBankName,
        payerAccountNumber: dto.payerAccountNumber,
        payerAccountName: dto.payerAccountName,
        createdByUserId: userId,
        participants: { create: dto.participants.map((p) => ({ name: p.name })) },
        items: {
          create: dto.items.map((i) => ({ description: i.description, amount: i.amount, quantity: i.quantity ?? 1 })),
        },
      },
      include: { participants: true, items: true },
    });
  }

  async findAllForUser(userId: number) {
    return this.prisma.splitBill.findMany({
      where: { createdByUserId: userId },
      orderBy: { billDate: 'desc' },
      include: { participants: true, items: true },
    });
  }

  private async getOwnedBillOrThrow(id: number, userId: number) {
    const bill = await this.prisma.splitBill.findUnique({
      where: { id },
      include: { participants: { include: { items: true } }, items: true },
    });
    if (!bill) throw new NotFoundException('Split bill tidak ditemukan');
    if (bill.createdByUserId !== userId) throw new ForbiddenException('Bukan split bill kamu');
    return bill;
  }

  async findOneDetail(id: number, userId: number) {
    const bill = await this.getOwnedBillOrThrow(id, userId);
    const totals = this.calculateTotals(bill.participants, bill.taxAmount, bill.serviceFeeAmount);
    return { ...bill, participantTotals: totals };
  }

  async assignItem(billId: number, itemId: number, userId: number, participantId: number | null) {
    await this.getOwnedBillOrThrow(billId, userId);

    const item = await this.prisma.splitBillItem.findUnique({ where: { id: itemId } });
    if (!item || item.splitBillId !== billId) throw new NotFoundException('Item tidak ditemukan');

    if (participantId !== null) {
      const participant = await this.prisma.splitBillParticipant.findUnique({ where: { id: participantId } });
      if (!participant || participant.splitBillId !== billId) {
        throw new NotFoundException('Participant tidak ditemukan');
      }
    }

    return this.prisma.splitBillItem.update({
      where: { id: itemId },
      data: { participantId },
    });
  }

  async getPublicSummary(slug: string) {
    const bill = await this.prisma.splitBill.findUnique({
      where: { publicSlug: slug },
      include: { participants: { include: { items: true } }, items: true },
    });
    if (!bill) throw new NotFoundException('Split bill tidak ditemukan');

    const totals = this.calculateTotals(bill.participants, bill.taxAmount, bill.serviceFeeAmount);

    return {
      restaurantName: bill.restaurantName,
      billDate: bill.billDate,
      taxAmount: bill.taxAmount,
      serviceFeeAmount: bill.serviceFeeAmount,
      payerBankName: bill.payerBankName,
      payerAccountNumber: bill.payerAccountNumber,
      payerAccountName: bill.payerAccountName,
      items: bill.items.map((i) => ({
        id: i.id,
        description: i.description,
        amount: i.amount,
        quantity: i.quantity,
        participantId: i.participantId,
        participantName: bill.participants.find((p) => p.id === i.participantId)?.name ?? null,
      })),
      participants: totals,
    };
  }

  // Endpoint publik ini SENGAJA tanpa auth/verifikasi identitas apapun — siapapun yang
  // pegang link share bisa toggle status lunas siapapun. Ini honor system antar teman
  // (bukan sistem finansial ketat), keputusan produk eksplisit, BUKAN celah keamanan yang
  // terlewat. Jangan tambahkan auth guard di sini tanpa didiskusikan ulang.
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
