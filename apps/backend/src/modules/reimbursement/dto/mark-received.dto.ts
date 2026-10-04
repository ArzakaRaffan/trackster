import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { Source } from '@prisma/client';

export class MarkReceivedDto {
  // Rekening tempat uangnya masuk. Default: source transaksi aslinya.
  @IsOptional()
  @IsEnum(Source)
  source?: Source;

  // Default: sekarang.
  @IsOptional()
  @IsISO8601()
  receivedAt?: string;
}
