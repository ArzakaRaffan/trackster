import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  token: string;

  @IsString()
  @MinLength(10, { message: 'Password minimal 10 karakter' })
  @MaxLength(72)
  newPassword: string;
}
