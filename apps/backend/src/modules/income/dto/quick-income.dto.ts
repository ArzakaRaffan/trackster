import { IsEnum, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { Source } from '@prisma/client';

export class QuickIncomeDto {
  @Transform(({ value }) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.-]+/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  streamName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsEnum(Source)
  source?: Source;
}
