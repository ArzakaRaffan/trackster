import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, Max, Min, ValidateNested } from 'class-validator';

export class DailyBudgetItem {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsNumber()
  @Min(0)
  amount: number;
}

export class UpdateBudgetDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyBudgetItem)
  budgets: DailyBudgetItem[];
}
