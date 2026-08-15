import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

class ParticipantInputDto {
  @IsString()
  @MinLength(1)
  name: string;
}

class ItemInputDto {
  @IsString()
  @MinLength(1)
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class CreateSplitBillDto {
  @IsString()
  @MinLength(1)
  restaurantName: string;

  @IsISO8601()
  billDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceFeeAmount?: number;

  @IsOptional()
  @IsString()
  payerBankName?: string;

  @IsOptional()
  @IsString()
  payerAccountNumber?: string;

  @IsOptional()
  @IsString()
  payerAccountName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ParticipantInputDto)
  participants: ParticipantInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemInputDto)
  items: ItemInputDto[];
}
