import { IsEnum, IsISO8601, IsNumber, IsString, Min, MinLength } from 'class-validator';
import { Source } from '@prisma/client';

export class CreateIncomeDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @MinLength(1)
  description: string;

  @IsEnum(Source)
  source: Source;

  @IsISO8601()
  receivedAt: string;
}
