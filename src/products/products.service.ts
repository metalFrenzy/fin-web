import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Product } from './entites/product.entity';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';


@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  private readonly PRODUCTS_LIST_KEY = 'products:list';
  private getProductKey(id: string) {
    return `product:${id}`;
  }

  async create(merchantId: string, createProductDto: CreateProductDto) {
    const product = this.productRepository.create({
      ...createProductDto,
      merchantId,
    });

    const savedProduct = await this.productRepository.save(product);
    await this.cacheManager.del(this.PRODUCTS_LIST_KEY);

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

  async findAll() {
    const cachedProducts = await this.cacheManager.get(this.PRODUCTS_LIST_KEY);

    if (cachedProducts) {
      console.log('✅ Cache HIT: Products list');
      return cachedProducts;
    }

    console.log('❌ Cache MISS: Products list - fetching from DB');

    const products = await this.productRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['merchant'],
    });

    const formattedProducts = products.map((product) => ({
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

    await this.cacheManager.set(this.PRODUCTS_LIST_KEY, formattedProducts);

    return formattedProducts;
  }

  async findById(id: string) {
    const cacheKey = this.getProductKey(id);

    const cachedProduct = await this.cacheManager.get(cacheKey);

    if (cachedProduct) {
      console.log(`✅ Cache HIT: Product ${id}`);
      return cachedProduct;
    }

    console.log(`❌ Cache MISS: Product ${id} - fetching from DB`);

    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['merchant'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const formattedProduct = {
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
    };

    await this.cacheManager.set(cacheKey, formattedProduct, 600);

    return formattedProduct;
  }

  async updateProduct(
    id: string,
    merchantId: string,
    updateProductDto: UpdateProductDto,
  ) {
    const product = await this.productRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.merchantId !== merchantId) {
      throw new ForbiddenException('You can only update your own products');
    }

    Object.assign(product, updateProductDto);

    const updatedProduct = await this.productRepository.save(product);

    await this.cacheManager.del(this.PRODUCTS_LIST_KEY);
    await this.cacheManager.del(this.getProductKey(id));

    return {
      message: 'Product updated successfully',
      product: {
        id: updatedProduct.id,
        name: updatedProduct.name,
        price: Number(updatedProduct.price),
        availableUnits: updatedProduct.availableUnits,
        updatedAt: updatedProduct.updatedAt,
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

  async invalidateProductCache(productId: string) {
    await this.cacheManager.del(this.getProductKey(productId));
    await this.cacheManager.del(this.PRODUCTS_LIST_KEY);
  }
}