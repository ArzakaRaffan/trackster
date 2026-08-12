import { IsString, MinLength } from 'class-validator';

export class TelegramConfigDto {
  @IsString()
  @MinLength(1)
  botToken: string;

  @IsString()
  @MinLength(1)
  chatId: string;
}
