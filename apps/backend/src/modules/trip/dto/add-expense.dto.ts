import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class ShareInputDto {
  @IsInt()
  @Min(0)
  memberIndex: number;

  @IsNumber()
  @Min(0)
  weight: number;
}

export class AddExpenseDto {
  @IsString()
  @MinLength(1)
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsInt()
  @Min(0)
  paidByMemberIndex: number;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShareInputDto)
  shares: ShareInputDto[];
}
