import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
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