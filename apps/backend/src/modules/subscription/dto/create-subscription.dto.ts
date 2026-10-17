import { IsBoolean, IsEnum, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max, Min, MinLength, MaxLength } from 'class-validator';

enum BillingCycleDto {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

enum SourceDto {
  BCA = 'BCA',
  JAGO = 'JAGO',
  GOPAY = 'GOPAY',
}

export class CreateSubscriptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(BillingCycleDto)
  cycle: 'MONTHLY' | 'YEARLY';

  @IsISO8601()
  nextDueDate: string;

  @IsOptional()
  @IsEnum(SourceDto)
  source?: 'BCA' | 'JAGO' | 'GOPAY';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  reminderDaysBefore?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}