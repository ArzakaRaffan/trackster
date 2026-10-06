import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Matches, Min, MinLength, ValidateNested } from 'class-validator';
import { AVATAR_SPEC_RE } from '../../split-bill/dto/set-avatar.dto';

export class TripMemberInputDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @Matches(AVATAR_SPEC_RE)
  avatar?: string;
}

export class TripExpenseInputDto {
  @IsString()
  @MinLength(1)
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  paidByMemberIndex?: number;

  @IsOptional()
  @IsArray()
  shares?: { memberIndex: number; weight: number }[];
}

export class CreateTripDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TripMemberInputDto)
  members: TripMemberInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripExpenseInputDto)
  expenses: TripExpenseInputDto[];
}
