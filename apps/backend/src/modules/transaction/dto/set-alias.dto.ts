import { IsString, MinLength } from 'class-validator';

export class SetAliasDto {
  @IsString()
  @MinLength(1)
  displayName: string;
}
