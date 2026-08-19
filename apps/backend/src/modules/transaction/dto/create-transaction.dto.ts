import { IsEnum, IsISO8601, IsNumber, IsString, Min, MinLength } from 'class-validator';
import { Category, Source } from '@prisma/client';

export class CreateTransactionDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @MinLength(1)
  description: string;

  @IsEnum(Source)
  source: Source;

  @IsEnum(Category)
  category: Category;

  @IsISO8601()
  occurredAt: string;
}
