import { IsNumber, Max, Min } from 'class-validator';

export class SimulateGoalDto {
  @IsNumber()
  @Min(1)
  @Max(100)
  cutPercent: number;
}
