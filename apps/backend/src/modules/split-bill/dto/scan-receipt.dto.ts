import { IsString, MinLength } from 'class-validator';

export class ScanReceiptDto {
  @IsString()
  @MinLength(1)
  imageBase64: string;
}
