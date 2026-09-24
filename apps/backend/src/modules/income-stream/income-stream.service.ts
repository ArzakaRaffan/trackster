import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateIncomeStreamDto } from './dto/create-income-stream.dto';
import { UpdateIncomeStreamDto } from './dto/update-income-stream.dto';

@Injectable()
export class IncomeStreamService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { activeOnly?: boolean } = {}) {
    return this.prisma.incomeStream.findMany({
      where: params.activeOnly ? { isActive: true } : undefined,
      orderBy: { id: 'asc' },
    });
  }

  async create(dto: CreateIncomeStreamDto) {
    return this.prisma.incomeStream.create({ data: dto });
  }

  async update(id: number, dto: UpdateIncomeStreamDto) {
    return this.prisma.incomeStream.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    return this.prisma.incomeStream.delete({ where: { id } });
  }
}
