import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TripService } from './trip.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateTripDto } from './dto/create-trip.dto';
import { AddExpenseDto } from './dto/add-expense.dto';

@Controller('trips')
export class TripController {
  constructor(private tripService: TripService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateTripDto) {
    const userId = (req as any).user.sub;
    return this.tripService.create(userId, dto);
  }

  // Tanpa JwtAuthGuard — Patungan Trip produk publik, siapapun boleh bikin tanpa akun.
  // Di-throttle per IP karena write endpoint publik (pola sama seperti split-bills/public).
  @UseGuards(ThrottlerGuard)
  @Post('public')
  async createPublicTrip(@Body() dto: CreateTripDto) {
    return this.tripService.createPublic(dto);
  }

  // Tanpa auth — dikelola lewat ownerToken (secret terpisah dari publicSlug).
  @Get('manage/:ownerToken')
  async getByOwnerToken(@Param('ownerToken') ownerToken: string) {
    return this.tripService.findByOwnerToken(ownerToken);
  }

  @Patch('manage/:ownerToken/expenses')
  async addExpenseByOwnerToken(
    @Param('ownerToken') ownerToken: string,
    @Body() dto: AddExpenseDto,
  ) {
    return this.tripService.addExpenseByOwnerToken(ownerToken, dto);
  }

  // Tanpa auth — temen buka link share cuma buat lihat + lihat settle-up.
  @Get('public/:slug')
  async getPublic(@Param('slug') slug: string) {
    return this.tripService.findPublic(slug);
  }
}
