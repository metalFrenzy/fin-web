import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorators';
import { CreateOrderDto } from './dto/order.dto';
import { Roles } from 'src/common/decorators/roles.decorators';
import { RolesGuard } from 'src/common/guards/role.guard';
import { UserRole } from 'src/common/enum/user-role.enum';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
    constructor(private readonly orderService: OrdersService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createOrder(@CurrentUser() user: any, @Body() orderDto: CreateOrderDto) {
        return this.orderService.createOrder(user.id, orderDto);
    }

    @Get()
    async getOrders(@CurrentUser() user: any) {
        return this.orderService.getUserOrders(user.id);
    }

    @Get('sales')
    @UseGuards(RolesGuard)
    @Roles(UserRole.MERCHANT)
    async getMerchantOrders(@CurrentUser() user: any) {
        return this.orderService.getMerchantOrders(user.id)
    }

    @Get(':id')
    async getOrderById(@CurrentUser() user: any, @Param('id') id: string) {
        return this.orderService.getOrderById(user.id, id);
    }
}
