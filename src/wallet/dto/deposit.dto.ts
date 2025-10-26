import { IsNumber, Min, } from "class-validator";

export class DepositDto {
    @IsNumber()
    @Min(1, { message: 'amount must be at least 1' })
    amount: number;
}