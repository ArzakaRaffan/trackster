import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export const ICON_PATTERN = /^(apps|branded|indonesia|decor)\/[A-Za-z0-9_.-]+\.svg$/;

export class UpdateMerchantAliasDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;

  /** null = hapus logo. */
  @IsOptional()
  @Matches(ICON_PATTERN)
  icon?: string | null;
}
