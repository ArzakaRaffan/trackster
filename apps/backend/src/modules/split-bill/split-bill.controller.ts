import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SplitBillService } from './split-bill.service';
import { SplitBillAiService } from './split-bill-ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateSplitBillDto } from './dto/create-split-bill.dto';
import { AssignItemDto } from './dto/assign-item.dto';
import { ScanReceiptDto } from './dto/scan-receipt.dto';

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

  // Scan struk TETAP login-only meskipun create bill sekarang publik — ini manggil AI API
  // berbayar (mwapi.dev), buka ke traffic anonim tanpa proteksi bisa habisin quota. Pembuat
  // bill anonim tetap bisa pakai fitur ini, cuma harus input item manual.
  @UseGuards(JwtAuthGuard)
  @Post('scan-receipt')
  async scanReceipt(@Body() dto: ScanReceiptDto) {
    const items = await this.splitBillAiService.scanReceipt(dto.imageBase64);
    return { items };
  }

  // Tanpa JwtAuthGuard — Split Bill adalah produk publik Trackster, siapapun boleh bikin bill
  // baru tanpa akun (lihat SplitBillService.createPublic). Di-throttle per IP (5x/10 menit)
  // karena ini write endpoint publik, beda dari endpoint publik lain yang cuma baca/toggle.
  @UseGuards(ThrottlerGuard)
  @Post('public')
  async createPublicBill(@Body() dto: CreateSplitBillDto) {
    return this.splitBillService.createPublic(dto);
  }

  // Tanpa auth — dikelola lewat ownerToken (secret terpisah dari publicSlug) yang cuma
  // dikasih sekali waktu create. Ini "login" pengganti buat pembuat bill anonim.
  @Get('manage/:ownerToken')
  async getByOwnerToken(@Param('ownerToken') ownerToken: string) {
    return this.splitBillService.findOneByOwnerToken(ownerToken);
  }

  @Patch('manage/:ownerToken/items/:itemId/assign')
  async assignItemByOwnerToken(
    @Param('ownerToken') ownerToken: string,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: AssignItemDto,
  ) {
    return this.splitBillService.assignItemByOwnerToken(ownerToken, itemId, dto.participantId ?? null);
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
