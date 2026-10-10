import { IsString, MaxLength, MinLength } from 'class-validator';

export class ScanReceiptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8_000_000) // ±6MB gambar
  imageBase64: string;
}
