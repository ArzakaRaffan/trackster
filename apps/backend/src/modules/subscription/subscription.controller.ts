import { Body, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Post, Put, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.findAll(user.id);
  }

  @Get('suggestions')
  suggestions(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.suggestions(user.id);
  }

  @Get('calendar-link')
  calendarLink(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.calendarLink(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptionService.create(user.id, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubscriptionDto) {
    return this.subscriptionService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.subscriptionService.remove(user.id, id);
  }
}

/** Publik (tanpa JWT): aplikasi kalender mengambil feed tanpa cookie. Akses dijaga tanda tangan di nama berkas. */
@Controller('calendar')
export class CalendarFeedController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Get(':file')
  async feed(@Param('file') file: string, @Res() res: Response) {
    const ics = await this.subscriptionService.calendarFeed(file);
    if (!ics) throw new NotFoundException();
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="trackster-langganan.ics"');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(ics);
  }
}
