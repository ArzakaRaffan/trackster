import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Pola harian: belajar dari kebiasaan, atau nominal per hari (index 0=Min..6=Sab) sebagai bobot. */
export class UpdateBudgetWeightsDto {
  @IsBoolean()
  autoWeights: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(100_000_000, { each: true })
  amounts?: number[];
}
