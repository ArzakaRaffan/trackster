import { IsString, MaxLength } from 'class-validator';

export class UpdateNoteDto {
  @IsString()
  @MaxLength(500)
  note: string;
}
