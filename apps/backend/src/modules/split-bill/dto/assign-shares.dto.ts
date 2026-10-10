import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNumber, Max, Min, ValidateNested } from 'class-validator';

class ShareInputDto {
  @IsInt()
  participantId: number;

  @IsNumber()
  @Min(0.01)
  @Max(9_999_999_999)
  weight: number;
}

export class AssignSharesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ShareInputDto)
  shares: ShareInputDto[];
}
