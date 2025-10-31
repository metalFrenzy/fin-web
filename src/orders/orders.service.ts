import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Order } from './entites/order.entity';
import { Product } from 'src/products/entites/product.entity';
import { WalletTransaction } from 'src/wallet/entities/wallet-transactions.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { CreateOrderDto } from './dto/order.dto';
import { PaymentMethod } from 'src/common/enum/payment-method.enum';
import { TransactionType } from 'src/common/enum/transaction-type.enum';
import { OrderStatus } from 'src/common/enum/order-status';


@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private transactionRepository: Repository<WalletTransaction>,
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    const { productId, paymentMethod } = createOrderDto;

    if (paymentMethod === PaymentMethod.WALLET) {
      return this.createWalletOrder(userId, productId);
    } else {
      throw new BadRequestException('Gateway payment not yet implemented');
    }
  }

  private async createWalletOrder(userId: string, productId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      if (product.availableUnits < 1) {
        throw new BadRequestException('Product is out of stock');
      }
      const userWallet = await queryRunner.manager
        .createQueryBuilder(Wallet, 'wallet')
        .where('wallet.userId = :userId', { userId })
        .setLock('pessimistic_write')
        .getOne();

      if (!userWallet) {
        throw new NotFoundException('Wallet not found');
      }

      const price = Number(product.price);
      const userBalance = Number(userWallet.balance);

      if (userBalance < price) {
        throw new BadRequestException(
          `Insufficient balance. Required: $${price}, Available: $${userBalance}`,
        );
      }

      const merchantWallet = await queryRunner.manager
        .createQueryBuilder(Wallet, 'wallet')
        .where('wallet.userId = :userId', { userId: product.merchantId })
        .setLock('pessimistic_write')
        .getOne();

      if (!merchantWallet) {
        throw new NotFoundException('Merchant wallet not found');
      }

      const userBalanceBefore = userBalance;
      userWallet.balance = userBalance - price;
      await queryRunner.manager.save(userWallet);

      const merchantBalanceBefore = Number(merchantWallet.balance);
      merchantWallet.balance = merchantBalanceBefore + price;
      await queryRunner.manager.save(merchantWallet);
      product.availableUnits -= 1;
      await queryRunner.manager.save(product);

      const order = queryRunner.manager.create(Order, {
        userId,
        productId: product.id,
        merchantId: product.merchantId,
        paymentMethod: PaymentMethod.WALLET,
        amount: price,
        status: OrderStatus.COMPLETED,
        metadata: {
          productName: product.name,
        },
      });
      const savedOrder = await queryRunner.manager.save(order);

      const userTransaction = queryRunner.manager.create(WalletTransaction, {
        walletId: userWallet.id,
        type: TransactionType.PURCHASE,
        amount: price,
        balanceBefore: userBalanceBefore,
        balanceAfter: userBalance - price,
        referenceId: savedOrder.id,
        metadata: {
          orderId: savedOrder.id,
          productId: product.id,
          productName: product.name,
        },
      });
      await queryRunner.manager.save(userTransaction);

      const merchantTransaction = queryRunner.manager.create(
        WalletTransaction,
        {
          walletId: merchantWallet.id,
          type: TransactionType.EARNING,
          amount: price,
          balanceBefore: merchantBalanceBefore,
          balanceAfter: merchantBalanceBefore + price,
          referenceId: savedOrder.id,
          metadata: {
            orderId: savedOrder.id,
            productId: product.id,
            productName: product.name,
            buyerId: userId,
          },
        },
      );
      await queryRunner.manager.save(merchantTransaction);

      await queryRunner.commitTransaction();

      return {
        message: 'Order created successfully',
        order: {
          id: savedOrder.id,
          productId: product.id,
          productName: product.name,
          amount: price,
          status: savedOrder.status,
          paymentMethod: savedOrder.paymentMethod,
          createdAt: savedOrder.createdAt,
        },
        wallet: {
          newBalance: Number(userWallet.balance),
        },
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getUserOrders(userId: string) {
    const orders = await this.orderRepository.find({
      where: { userId },
      relations: ['product', 'merchant'],
      order: { createdAt: 'DESC' },
    });

    return orders.map((order) => ({
      id: order.id,
      product: {
        id: order.product.id,
        name: order.product.name,
      },
      merchant: {
        id: order.merchant.id,
        email: order.merchant.email,
      },
      amount: Number(order.amount),
      status: order.status,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
    }));
  }

  async getMerchantOrders(merchantId: string) {
    const orders = await this.orderRepository.find({
      where: { merchantId },
      relations: ['product', 'user'],
      order: { createdAt: 'DESC' },
    });

    return orders.map((order) => ({
      id: order.id,
      product: {
        id: order.product.id,
        name: order.product.name,
      },
      buyer: {
        id: order.user.id,
        email: order.user.email,
      },
      amount: Number(order.amount),
      status: order.status,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
    }));
  }

  async getOrder(orderId: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['product', 'merchant', 'user'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== userId && order.merchantId !== userId) {
      throw new BadRequestException('You do not have access to this order');
    }

    return {
      id: order.id,
      product: {
        id: order.product.id,
        name: order.product.name,
      },
      merchant: {
        id: order.merchant.id,
        email: order.merchant.email,
      },
      buyer: {
        id: order.user.id,
        email: order.user.email,
      },
      amount: Number(order.amount),
      status: order.status,
      paymentMethod: order.paymentMethod,
      metadata: order.metadata,
      createdAt: order.createdAt,
    };
  }
}