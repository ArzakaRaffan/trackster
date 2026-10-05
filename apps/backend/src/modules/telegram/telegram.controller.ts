import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramConfigDto } from './dto/telegram-config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('telegram')
export class TelegramController {
  constructor(private telegramService: TelegramService) {}

  @Get('status')
  async status(@CurrentUser() user: AuthUser) {
    return this.telegramService.getConfig(user.id);
  }

  @Put('config')
  async updateConfig(@CurrentUser() user: AuthUser, @Body() dto: TelegramConfigDto) {
    return this.telegramService.updateConfig(user.id, dto);
  }

  @Post('test')
  async test(@CurrentUser() user: AuthUser) {
    return this.telegramService.sendTest(user.id);
  }
}
