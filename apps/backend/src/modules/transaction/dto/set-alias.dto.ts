import { IsString, MinLength, MaxLength } from 'class-validator';

export class SetAliasDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName: string;
}
