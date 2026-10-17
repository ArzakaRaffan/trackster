import { IsEnum, IsISO8601, IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Source } from '@prisma/client';

export class CreateIncomeDto {
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

  @IsISO8601()
  receivedAt: string;
}
