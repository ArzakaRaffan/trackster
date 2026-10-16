import { BudgetMode } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateBudgetSettingsDto {
  @IsOptional()
  @IsEnum(BudgetMode)
  mode?: BudgetMode;

  /** null = lepas anchor. Wajib terisi (stream WEEKLY/MONTHLY milik user) kalau mode CYCLE. */
  @IsOptional()
  @IsInt()
  anchorStreamId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  reservePct?: number;

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(90)
  horizonDays?: number;
}
