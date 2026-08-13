import { IsString, MinLength } from 'class-validator';

export class UpsertMerchantAliasDto {
  @IsString()
  @MinLength(1)
  rawDescription: string;

  @IsString()
  @MinLength(1)
  displayName: string;
}
