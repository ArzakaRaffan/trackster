import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class TelegramConfigDto {
  // Optional biar toggle notifyEveryTransaction bisa PUT tanpa perlu kirim ulang token/chatId.
  @IsOptional()
  @IsString()
  @MinLength(1)
  botToken?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  chatId?: string;

  @IsOptional()
  @IsBoolean()
  notifyEveryTransaction?: boolean;
}
