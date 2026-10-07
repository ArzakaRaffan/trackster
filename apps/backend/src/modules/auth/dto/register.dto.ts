import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  inviteCode: string;

  @IsString()
  @Matches(/^[a-z0-9_]{3,24}$/, { message: 'Username 3–24 karakter: huruf kecil, angka, atau _' })
  username: string;

  @IsString()
  @MinLength(10, { message: 'Password minimal 10 karakter' })
  @MaxLength(72) // batas bcrypt
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  displayName?: string;
}
