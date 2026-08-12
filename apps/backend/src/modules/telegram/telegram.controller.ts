import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramConfigDto } from './dto/telegram-config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('telegram')
export class TelegramController {
  constructor(private telegramService: TelegramService) {}

  @Get('status')
  async status() {
    return this.telegramService.getConfig();
  }

  @Put('config')
  async updateConfig(@Body() dto: TelegramConfigDto) {
    return this.telegramService.updateConfig(dto);
  }

  @Post('test')
  async test() {
    return this.telegramService.sendTest();
  }
}
