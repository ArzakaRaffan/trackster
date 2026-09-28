import { IsBoolean, IsOptional } from 'class-validator';

export class SetBigDto {
  @IsOptional()
  @IsBoolean()
  isBig: boolean | null;
}
