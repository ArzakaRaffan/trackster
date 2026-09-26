import { IsBoolean, IsInt, IsOptional } from 'class-validator';

/** "Perlu dicek" (status PENDING) diselesaikan user: pilih stream (→ CONFIRMED) atau tandai
 * bukan pemasukan/internal (→ INTERNAL). Saldo TIDAK berubah lagi di sini — sudah digerakkan
 * saat Income dibuat (setiap email Jago "menerima uang" selalu JAGO+, lihat IncomeService). */
export class ResolveIncomeDto {
  @IsOptional()
  @IsInt()
  streamId?: number;

  @IsOptional()
  @IsBoolean()
  notIncome?: boolean;
}
