import { IsInt, IsNumber, IsString, Min, MinLength } from 'class-validator';

export class CreateReimbursementDto {
  @IsInt()
  transactionId: number;

  @IsString()
  @MinLength(1)
  personName: string;

  @IsNumber()
  @Min(1)
  amount: number;
}
