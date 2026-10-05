import { Injectable, NotFoundException } from '@nestjs/common';
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
    return this.prisma.incomeStream.create({ data: { ...dto, userId } });
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
