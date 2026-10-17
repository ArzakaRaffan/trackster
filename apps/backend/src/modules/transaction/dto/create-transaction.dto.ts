import { IsEnum, IsISO8601, IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Category, Source } from '@prisma/client';

export class CreateTransactionDto {
  @IsNumber()
  @Min(0)
  @Max(9_999_999_999) // Decimal(12,2)
  amount: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description: string;

  @IsEnum(Source)
  source: Source;

  @IsEnum(Category)
  category: Category;

  @IsISO8601()
  occurredAt: string;
}
