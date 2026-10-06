import { Category, Source } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

// Decimal(12,2) -> maks 9.999.999.999. Shortcut sering mengirim angka sebagai teks ("50000"): terima teks angka polos, tolak sisanya.
const MAX_AMOUNT = 9_999_999_999;
const toAmount = ({ value }: { value: unknown }) => (typeof value === 'string' && /^\d{1,10}(\.\d{1,2})?$/.test(value.trim()) ? Number(value) : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class IngestTransactionDto {
  @Transform(toAmount)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(MAX_AMOUNT)
  amount: number;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description: string;

  // Wajib: menebak dompet default itu diam-diam salah untuk user yang tak punya BCA.
  @IsEnum(Source)
  source: Source;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsOptional()
  @IsEnum(Category)
  category?: Category;
}

export class IngestIncomeDto {
  @Transform(toAmount)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(MAX_AMOUNT)
  amount: number;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description: string;

  @IsEnum(Source)
  source: Source;

  @IsOptional()
  @IsISO8601()
  receivedAt?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value))
  @IsInt()
  @Min(1)
  streamId?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  streamName?: string;
}
