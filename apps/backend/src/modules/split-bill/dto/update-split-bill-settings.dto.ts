import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateSplitBillSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  servicePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceFeeAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsNumber()
  roundingUnit?: number;

  @IsOptional()
  @IsBoolean()
  taxAfterService?: boolean;
}
