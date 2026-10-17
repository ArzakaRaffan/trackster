import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CorrectBalanceDto {
  @IsNumber()
  newBalance: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
