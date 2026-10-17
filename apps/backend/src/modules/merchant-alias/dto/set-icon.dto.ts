import { Category } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { ICON_PATTERN } from './update-merchant-alias.dto';

export class SetMerchantIconDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  rawDescription: string;

  @IsOptional()
  @Matches(ICON_PATTERN)
  icon?: string | null;
}

export class SetCategoryIconDto {
  @IsEnum(Category)
  category: Category;

  @IsOptional()
  @Matches(ICON_PATTERN)
  icon?: string | null;
}
