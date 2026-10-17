import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpsertMerchantAliasDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  rawDescription: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName: string;
}
