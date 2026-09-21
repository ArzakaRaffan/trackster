import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiChatService } from './ai-chat.service';

class ChatDto {
  message: string;
}

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private aiChatService: AiChatService) {}

  @Post('chat')
  async chat(@Body() body: ChatDto) {
    const reply = await this.aiChatService.handleMessage(body.message, { channel: 'web' });
    return { reply };
  }
}
