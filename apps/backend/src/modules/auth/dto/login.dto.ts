import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(100)
  username: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200) // bcrypt cuma baca 72 byte; batas ini cegah body raksasa
  password: string;
}
