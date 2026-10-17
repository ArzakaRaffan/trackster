import { IsInt, IsNumber, IsString, Min, MinLength, MaxLength } from 'class-validator';

export class CreateReimbursementDto {
  @IsInt()
  transactionId: number;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  personName: string;

  @IsNumber()
  @Min(1)
  amount: number;
}
