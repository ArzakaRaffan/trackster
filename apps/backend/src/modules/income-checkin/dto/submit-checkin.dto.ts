import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsISO8601, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';

export class CheckinEntryDto {
  @IsInt()
  streamId: number;

  /** SESSION: jumlah sesi. DEDUCTION: hari absen. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  units?: number;

  /** SESSION: sesi offline (dapat transport). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  extraUnits?: number;

  /** VARIABLE/IRREGULAR: nominal langsung. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}

export class SubmitCheckinDto {
  /** Tanggal apa saja dalam minggu yang di-checkin — dinormalisasi ke Senin di server. */
  @IsISO8601()
  week: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckinEntryDto)
  entries: CheckinEntryDto[];
}
