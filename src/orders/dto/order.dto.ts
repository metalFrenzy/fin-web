import { IsEnum, IsUUID } from "class-validator";
import { PaymentMethod } from "src/common/enum/payment-method.enum";

export class CreateOrderDto {
    @IsUUID()
    productId: string;

    @IsEnum(PaymentMethod, {
        message: 'Payment method must be "Wallet" or "Gateway"'
    })
    paymentMethod: PaymentMethod;
}