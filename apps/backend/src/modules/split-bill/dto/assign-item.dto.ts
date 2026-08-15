import { IsInt, IsOptional } from 'class-validator';

export class AssignItemDto {
  @IsOptional()
  @IsInt()
  participantId: number | null;
}
