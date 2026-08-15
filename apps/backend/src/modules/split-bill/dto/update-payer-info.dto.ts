import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePayerInfoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  payerName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  payerBank?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  payerAccountNumber?: string;

  @IsOptional()
  @IsString()
  payerContact?: string;
}
