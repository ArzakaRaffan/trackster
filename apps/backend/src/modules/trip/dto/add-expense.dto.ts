import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class ShareInputDto {
  @IsInt()
  @Min(0)
  @Max(9_999_999_999)
  memberIndex: number;

  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  weight: number;
}

export class AddExpenseDto {
  @IsString()
  @MaxLength(200)
  @MinLength(1)
  description: string;

  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  amount: number;

  @IsInt()
  @Min(0)
  @Max(9_999_999_999)
  paidByMemberIndex: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  date?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ShareInputDto)
  shares: ShareInputDto[];
}
