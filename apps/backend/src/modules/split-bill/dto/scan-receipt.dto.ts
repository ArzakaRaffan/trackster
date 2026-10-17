import { IsString, MaxLength, MinLength } from 'class-validator';

export class ScanReceiptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(6_000_000) // ±4,5MB gambar; browser mengecilkan foto dulu (lib/image.ts), batas body rute ini 6mb (main.ts)
  imageBase64: string;
}
