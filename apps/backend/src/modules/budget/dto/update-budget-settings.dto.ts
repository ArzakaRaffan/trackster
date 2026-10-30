import { BudgetBasis, BudgetPeriod } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Setelan budget periode (docs/budget-kebiasaan.md). Menyimpan → `period` terisi → banner "cek cara budget" hilang. */
export class UpdateBudgetSettingsDto {
  @IsOptional()
  @IsEnum(BudgetPeriod)
  period?: BudgetPeriod;

  /** WEEKLY: 0=Min..6=Sab. MONTHLY: 1..31. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(31)
  periodDay?: number;

  @IsOptional()
  @IsEnum(BudgetBasis)
  basis?: BudgetBasis;

  /** Basis TARGET: mau belanja berapa per periode. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  targetAmount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  reservePct?: number;

  @IsOptional()
  @IsBoolean()
  autoWeights?: boolean;

  /** Sisa periode lalu ikut ke periode ini. */
  @IsOptional()
  @IsBoolean()
  rolloverEnabled?: boolean;

  /** Pemasukan pasti utama (penentu hari mulai & gaji lebih awal). null = lepas. */
  @IsOptional()
  @IsInt()
  anchorStreamId?: number | null;
}
