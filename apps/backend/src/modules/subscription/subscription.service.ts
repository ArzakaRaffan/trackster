import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BillingCycle, Source } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { GmailAuthService } from '../gmail/gmail-auth.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { startOfWibDay } from '../../common/wib';

type SubRow = {
  id: number;
  name: string;
  amount: unknown;
  cycle: BillingCycle;
  nextDueDate: Date;
  source: Source | null;
  notes: string | null;
  reminderDaysBefore: number;
  isActive: boolean;
  googleCalendarEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private gmailAuth: GmailAuthService,
  ) {}

  private serialize(row: SubRow) {
    return {
      ...row,
      amount: Number(row.amount),
      nextDueDate: row.nextDueDate.toISOString().slice(0, 10),
    };
  }

  async findAll() {
    const rows = await this.prisma.subscription.findMany({
      orderBy: [{ isActive: 'desc' }, { nextDueDate: 'asc' }],
    });
    return rows.map((r) => this.serialize(r as SubRow));
  }

  async create(dto: CreateSubscriptionDto) {
    const created = await this.prisma.subscription.create({
      data: {
        name: dto.name.trim(),
        amount: dto.amount,
        cycle: dto.cycle,
        nextDueDate: new Date(dto.nextDueDate),
        source: dto.source,
        notes: dto.notes?.trim() || null,
        reminderDaysBefore: dto.reminderDaysBefore ?? 3,
        isActive: dto.isActive ?? true,
      },
    });

    const calendar = await this.syncCalendar(created as SubRow);
    return { ...this.serialize((calendar.row ?? created) as SubRow), calendarSync: calendar.status };
  }

  async update(id: number, dto: UpdateSubscriptionDto) {
    const existing = await this.prisma.subscription.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Langganan tidak ditemukan');

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.cycle !== undefined && { cycle: dto.cycle }),
        ...(dto.nextDueDate !== undefined && { nextDueDate: new Date(dto.nextDueDate) }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
        ...(dto.reminderDaysBefore !== undefined && { reminderDaysBefore: dto.reminderDaysBefore }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    const calendar = await this.syncCalendar(updated as SubRow);
    return { ...this.serialize((calendar.row ?? updated) as SubRow), calendarSync: calendar.status };
  }

  async remove(id: number) {
    const existing = await this.prisma.subscription.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Langganan tidak ditemukan');

    await this.deleteCalendarEvent(existing.googleCalendarEventId);
    await this.prisma.subscription.delete({ where: { id } });
    return { success: true };
  }

  /** Dipakai mascot: langganan aktif yang jatuh tempo dalam N hari. */
  async getUpcomingReminders(withinDays = 3) {
    const rows = await this.prisma.subscription.findMany({
      where: { isActive: true },
      orderBy: { nextDueDate: 'asc' },
    });
    const now = startOfWibDay(new Date());
    const DAY_MS = 24 * 60 * 60 * 1000;

    return rows
      .map((s) => {
        // nextDueDate: kolom @db.Date, sudah tengah malam UTC untuk tanggal itu — tidak perlu konversi WIB.
        const due = s.nextDueDate;
        const daysLeft = Math.round((due.getTime() - now.getTime()) / DAY_MS);
        return { ...this.serialize(s as SubRow), daysLeft };
      })
      .filter((s) => s.daysLeft >= 0 && s.daysLeft <= withinDays);
  }

  private formatAmount(amount: number) {
    return `Rp${amount.toLocaleString('id-ID')}`;
  }

  private toDateOnly(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  private nextDay(dateStr: string) {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  private buildEventBody(sub: SubRow) {
    const amount = Number(sub.amount);
    const start = this.toDateOnly(sub.nextDueDate);
    const end = this.nextDay(start);
    const cycleLabel = sub.cycle === 'YEARLY' ? 'tahunan' : 'bulanan';
    const reminderDays = Math.max(0, sub.reminderDaysBefore);
    const overrides: Array<{ method: 'popup'; minutes: number }> = [{ method: 'popup', minutes: 0 }];
    if (reminderDays > 0) {
      overrides.push({ method: 'popup', minutes: reminderDays * 24 * 60 });
    }

    return {
      summary: `Langganan: ${sub.name} — ${this.formatAmount(amount)}`,
      description: [
        `Trackster reminder · ${cycleLabel}`,
        sub.source ? `Rekening: ${sub.source}` : null,
        sub.notes ? `Catatan: ${sub.notes}` : null,
        'Dikelola dari Trackster. Edit di app biar Calendar ikut update.',
      ]
        .filter(Boolean)
        .join('\n'),
      start: { date: start },
      end: { date: end },
      recurrence: [sub.cycle === 'YEARLY' ? 'RRULE:FREQ=YEARLY' : 'RRULE:FREQ=MONTHLY'],
      reminders: {
        useDefault: false,
        overrides,
      },
    };
  }

  private async syncCalendar(sub: SubRow): Promise<{ status: 'synced' | 'removed' | 'skipped' | 'error'; row?: SubRow; message?: string }> {
    if (!sub.isActive) {
      await this.deleteCalendarEvent(sub.googleCalendarEventId);
      if (sub.googleCalendarEventId) {
        const row = await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { googleCalendarEventId: null },
        });
        return { status: 'removed', row: row as SubRow };
      }
      return { status: 'removed' };
    }

    const calendar = await this.gmailAuth.getCalendarClient();
    if (!calendar) {
      return {
        status: 'skipped',
        message: 'Google belum terhubung. Hubungkan ulang di Setting supaya event Calendar dibuat.',
      };
    }

    const body = this.buildEventBody(sub);

    try {
      if (sub.googleCalendarEventId) {
        await calendar.events.update({
          calendarId: 'primary',
          eventId: sub.googleCalendarEventId,
          requestBody: body,
        });
        return { status: 'synced', row: sub };
      }

      const created = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: body,
      });
      const eventId = created.data.id || null;
      const row = await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { googleCalendarEventId: eventId },
      });
      return { status: 'synced', row: row as SubRow };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.warn(`Calendar sync gagal untuk subscription #${sub.id}: ${message}`);
      return {
        status: 'error',
        message:
          'Gagal sync ke Google Calendar. Pastikan Calendar API aktif di Google Cloud dan kamu sudah reconnect Google di Setting (scope calendar).',
      };
    }
  }

  private async deleteCalendarEvent(eventId: string | null | undefined) {
    if (!eventId) return;
    const calendar = await this.gmailAuth.getCalendarClient();
    if (!calendar) return;
    try {
      await calendar.events.delete({ calendarId: 'primary', eventId });
    } catch (err) {
      this.logger.warn(`Gagal hapus calendar event ${eventId}: ${(err as Error).message}`);
    }
  }
}