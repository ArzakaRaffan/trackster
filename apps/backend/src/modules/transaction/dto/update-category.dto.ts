import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Category } from '@prisma/client';

export class UpdateCategoryDto {
  @IsEnum(Category)
  category: Category;

  /** true = simpan sebagai rule merchant + update semua transaksi lama dengan merchantKey sama. */
  @IsOptional()
  @IsBoolean()
  applyToAll?: boolean;
}
