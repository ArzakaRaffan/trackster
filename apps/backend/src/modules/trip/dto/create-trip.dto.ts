import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { AVATAR_SPEC_RE } from '../../split-bill/dto/set-avatar.dto';
import { ShareInputDto } from './add-expense.dto';

export class TripMemberInputDto {
  @IsString()
  @MaxLength(200)
  @MinLength(1)
  name: string;

  @IsOptional()
  @Matches(AVATAR_SPEC_RE)
  avatar?: string;
}

export class TripExpenseInputDto {
  @IsString()
  @MaxLength(200)
  @MinLength(1)
  description: string;

  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  amount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9_999_999_999)
  paidByMemberIndex?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true }) // dulu bentuk bebas: memberIndex "length"/"__proto__" & weight teks -> 500
  @Type(() => ShareInputDto)
  shares?: ShareInputDto[];
}

export class CreateTripDto {
  @IsString()
  @MaxLength(200)
  @MinLength(1)
  name: string;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TripMemberInputDto)
  members: TripMemberInputDto[];

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TripExpenseInputDto)
  expenses: TripExpenseInputDto[];
}
