import { IsBoolean, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class TelegramConfigDto {
  // Optional biar toggle notifyEveryTransaction bisa PUT tanpa perlu kirim ulang token/chatId.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  botToken?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  chatId?: string;

  @IsOptional()
  @IsBoolean()
  notifyEveryTransaction?: boolean;
}
