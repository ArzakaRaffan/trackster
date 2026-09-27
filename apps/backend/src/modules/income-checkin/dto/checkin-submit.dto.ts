import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsISO8601, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';

export class CheckinEntryDto {
  @IsInt()
  @Min(1)
  streamId: number;

  /** SESSION: jumlah sesi; DEDUCTION: hari absen. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  units?: number;

  /** SESSION: jumlah sesi offline (dapat transport). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  extraUnits?: number;

  /** VARIABLE: nominal aktual bulan ini (user yang tahu, bukan dihitung dari formula). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}

export class CheckinSubmitDto {
  /** Tanggal apa saja di minggu yang di-checkin (WIB), dipakai untuk resolve Senin minggu itu. */
  @IsISO8601()
  week: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckinEntryDto)
  entries: CheckinEntryDto[];
}
