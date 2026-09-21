import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ContributeGoalDto {
  @IsNumber()
  @Min(-999999999)
  amount: number; // positif = nambah, negatif = tarik

  @IsOptional()
  @IsString()
  note?: string;
}
