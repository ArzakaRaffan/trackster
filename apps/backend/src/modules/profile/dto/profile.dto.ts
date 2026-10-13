import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Source } from '@prisma/client';

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40)
  displayName?: string;

  /** Nama persis seperti di rekening bank — parser memakainya untuk mengenali transfer ke diri sendiri. */
  @IsOptional() @IsString() @MaxLength(80)
  fullName?: string;
}

export class OwnAccountDto {
  @IsOptional() @IsEnum(Source)
  source?: Source;

  @IsOptional() @IsString() @MaxLength(40)
  label?: string;

  @IsString() @Matches(/^[\d\s.-]{6,30}$/, { message: 'Nomor rekening hanya angka (6–20 digit)' })
  accountNumber: string;
}

export class ReplaceAccountsDto {
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => OwnAccountDto)
  accounts: OwnAccountDto[];
}

export class BanksDto {
  @IsArray() @ArrayMaxSize(10) @IsEnum(Source, { each: true })
  sources: Source[];
}
