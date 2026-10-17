import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNumber, Max, Min, ValidateNested } from 'class-validator';

export class DailyBudgetItem {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  amount: number;
}

export class UpdateBudgetDto {
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => DailyBudgetItem)
  budgets: DailyBudgetItem[];
}
