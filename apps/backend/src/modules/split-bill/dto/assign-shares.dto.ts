import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, Min, ValidateNested } from 'class-validator';

class ShareInputDto {
  @IsInt()
  participantId: number;

  @IsNumber()
  @Min(0.01)
  weight: number;
}

export class AssignSharesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShareInputDto)
  shares: ShareInputDto[];
}
