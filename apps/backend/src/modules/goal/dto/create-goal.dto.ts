import { IsNumber, IsString, IsOptional, IsISO8601, Min, MinLength } from 'class-validator';

export class CreateGoalDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsNumber()
  @Min(0)
  targetAmount: number;

  @IsOptional()
  @IsISO8601()
  targetDate?: string;
}
