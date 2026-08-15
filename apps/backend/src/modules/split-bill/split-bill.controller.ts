import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SplitBillService } from './split-bill.service';
import { SplitBillAiService } from './split-bill-ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateSplitBillDto } from './dto/create-split-bill.dto';
import { AssignItemDto } from './dto/assign-item.dto';
import { ScanReceiptDto } from './dto/scan-receipt.dto';
import { UpdatePayerInfoDto } from './dto/update-payer-info.dto';

@Controller('split-bills')
export class SplitBillController {
  constructor(
    private splitBillService: SplitBillService,
    private splitBillAiService: SplitBillAiService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateSplitBillDto) {
    const userId = (req as any).user.sub;
    return this.splitBillService.create(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Req() req: Request) {
    const userId = (req as any).user.sub;
    return this.splitBillService.findAllForUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const userId = (req as any).user.sub;
    return this.splitBillService.findOneDetail(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/items/:itemId/assign')
  async assignItem(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: AssignItemDto,
  ) {
    const userId = (req as any).user.sub;
    return this.splitBillService.assignItem(id, itemId, userId, dto.participantId ?? null);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/payer-info')
  async updatePayerInfo(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePayerInfoDto,
  ) {
    const userId = (req as any).user.sub;
    return this.splitBillService.updatePayerInfo(id, userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('scan-receipt')
  async scanReceipt(@Body() dto: ScanReceiptDto) {
    const items = await this.splitBillAiService.scanReceipt(dto.imageBase64);
    return { items };
  }

  // Tanpa JwtAuthGuard — dipakai temen yang nggak punya akun Trackster lewat link share.
  @Get('public/:slug')
  async getPublic(@Param('slug') slug: string) {
    return this.splitBillService.getPublicSummary(slug);
  }

  // Tanpa JwtAuthGuard secara sengaja — lihat komentar di SplitBillService.togglePaidPublic.
  @Patch('public/:slug/participants/:participantId/mark-paid')
  async markPaidPublic(@Param('slug') slug: string, @Param('participantId', ParseIntPipe) participantId: number) {
    return this.splitBillService.togglePaidPublic(slug, participantId);
  }
}
