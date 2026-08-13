import { IsString, MinLength } from 'class-validator';

export class UpdateMerchantAliasDto {
  @IsString()
  @MinLength(1)
  displayName: string;
}
