import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(10, { message: 'Password minimal 10 karakter' })
  @MaxLength(72)
  newPassword: string;
}
