import { IsNumber, Min } from 'class-validator';

export class WithdrawDto {
    @IsNumber()
    @Min(1, { message: 'Amount must be at least 1' })
    amount: number;
}