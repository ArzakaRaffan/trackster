import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsISO8601, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { AVATAR_SPEC_RE } from './set-avatar.dto';

class ParticipantInputDto {
  @IsString()
  @MaxLength(200)
  @MinLength(1)
  name: string;

  @IsOptional()
  @Matches(AVATAR_SPEC_RE)
  avatar?: string;
}

class ItemInputDto {
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
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  shares?: any[];
}

export class CreateSplitBillDto {
  @IsString()
  @MaxLength(200)
  @MinLength(1)
  restaurantName: string;

  @IsISO8601()
  billDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  serviceFeeAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  taxPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  servicePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  discountPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  deliveryFee?: number;

  @IsOptional()
  @IsInt()
  roundingUnit?: number;

  @IsOptional()
  taxAfterService?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  payerBankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  payerAccountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  payerAccountName?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ParticipantInputDto)
  participants: ParticipantInputDto[];

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ItemInputDto)
  items: ItemInputDto[];
}
