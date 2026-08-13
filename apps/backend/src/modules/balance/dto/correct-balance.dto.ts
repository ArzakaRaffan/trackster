import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CorrectBalanceDto {
  @IsNumber()
  newBalance: number;

  @IsOptional()
  @IsString()
  note?: string;
}
