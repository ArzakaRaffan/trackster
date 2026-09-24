import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { IncomeCadence, IncomeKind, Source } from '@prisma/client';

export class CreateIncomeStreamDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(IncomeKind)
  kind: IncomeKind;

  @IsEnum(IncomeCadence)
  cadence: IncomeCadence;

  @IsEnum(Source)
  source: Source;

  @IsOptional()
  @IsInt()
  @Min(0)
  payDayOfWeek?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  payDayOfMonth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sessionRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sessionExtra?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxUnits?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductionPerUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  typicalUnits?: number;

  @IsOptional()
  @IsString({ each: true })
  matchKeywords?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
