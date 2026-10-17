import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength, MaxLength } from 'class-validator';
import { Source } from '@prisma/client';

export class UpdateIncomeDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsEnum(Source)
  source?: Source;

  @IsOptional()
  @IsISO8601()
  receivedAt?: string;
}
