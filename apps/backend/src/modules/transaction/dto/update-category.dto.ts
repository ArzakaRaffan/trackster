import { IsEnum } from 'class-validator';
import { Category } from '@prisma/client';

export class UpdateCategoryDto {
  @IsEnum(Category)
  category: Category;
}
