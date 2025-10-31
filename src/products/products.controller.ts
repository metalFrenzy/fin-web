import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorators';
import { Roles } from 'src/common/decorators/roles.decorators';
import { UserRole } from 'src/common/enum/user-role.enum';
import { RolesGuard } from 'src/common/guards/role.guard';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';


@Controller('products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MERCHANT)
    @HttpCode(HttpStatus.CREATED)
    async create(
        @CurrentUser() user: any,
        @Body() createProductDto: CreateProductDto,
    ) {
        return this.productsService.create(user.id, createProductDto);
    }

    @Get()
    async findAll() {
        return this.productsService.findAll();
    }

    @Get('my-products')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MERCHANT)
    async getMyProducts(@CurrentUser() user: any) {
        return this.productsService.findByMerchant(user.id);
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.productsService.findById(id);
    }


    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MERCHANT)
    async update(
        @Param('id') id: string,
        @CurrentUser() user: any,
        @Body() updateProductDto: UpdateProductDto,
    ) {
        return this.productsService.updateProduct(id, user.id, updateProductDto)
    }
}