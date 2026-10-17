import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class ContributeGoalDto {
  @IsNumber()
  @Min(-999999999)
  amount: number; // positif = nambah, negatif = tarik

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
