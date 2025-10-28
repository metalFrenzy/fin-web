import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entites/product.entity';
import { Repository } from 'typeorm/repository/Repository';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
    constructor(@InjectRepository(Product) private productRepository: Repository<Product>) { }

    async findAll() {
        const products = await this.productRepository.find({
            order: { createdAt: 'DESC' },
            relations: ['merchant'],
        });

        return products.map((product) => ({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            availableUnits: product.availableUnits,
            merchant: {
                id: product.merchant.id,
                email: product.merchant.email,
            },
            createdAt: product.createdAt,
        }));
    }

    async findById(productId: string) {
        const product = await this.productRepository.findOne({
            where: { id: productId },
            relations: ['merchant'],
        });

        if (!product) {
            throw new NotFoundException('product not found');
        }

        return {
            id: product.id,
            name: product.name,
            price: Number(product.price),
            availableUnits: product.availableUnits,
            merchant: {
                id: product.merchant.id,
                email: product.merchant.email,
            },
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
        }
    }


    async create(merchantId: string, product: CreateProductDto) {
        const newProduct = this.productRepository.create({
            ...product,
            merchantId,
        })

        const savedProduct = await this.productRepository.save(product);

        return {
            message: 'Product created successfully',
            product: {
                id: savedProduct.id,
                name: savedProduct.name,
                price: Number(savedProduct.price),
                availableUnits: savedProduct.availableUnits,
                merchantId: savedProduct.merchantId,
                createdAt: savedProduct.createdAt,
            },
        };
    }

    async updateProduct(merchantId: string, updatedProduct: UpdateProductDto, productId: string) {
        const product = await this.productRepository.findOne({
            where: { id: productId }
        })

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        if (product.merchantId !== merchantId) {
            throw new ForbiddenException('You can only update your own products');
        }

        Object.assign(product, updatedProduct)

        const newProduct = await this.productRepository.save(product);

        return {
            message: 'Product updated successfully',
            product: {
                id: newProduct.id,
                name: newProduct.name,
                price: Number(newProduct.price),
                availableUnits: newProduct.availableUnits,
                updatedAt: newProduct.updatedAt,
            },
        };
    }

    async findByMerchant(merchantId: string) {
        const products = await this.productRepository.find({
            where: { merchantId },
            order: { createdAt: 'DESC' },
        });

        return products.map((product) => ({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            availableUnits: product.availableUnits,
            createdAt: product.createdAt,
        }));
    }

}



