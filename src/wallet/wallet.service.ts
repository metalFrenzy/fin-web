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
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transactions.entity';
import { TransactionType } from 'src/common/enum/transaction-type.enum';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private transactionRepository: Repository<WalletTransaction>,
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  private getWalletCacheKey(userId: string) {
    return `wallet:${userId}`;
  }

  async getWalletByUserId(userId: string) {
    const cacheKey = this.getWalletCacheKey(userId);

    const cachedWallet = await this.cacheManager.get(cacheKey);

    if (cachedWallet) {
      console.log(`✅ Cache HIT: Wallet for user ${userId}`);
      return cachedWallet;
    }

    console.log(`❌ Cache MISS: Wallet for user ${userId}`);

    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const walletData = {
      id: wallet.id,
      balance: Number(wallet.balance),
      userId: wallet.userId,
    };

    await this.cacheManager.set(cacheKey, walletData, 60);

    return walletData;
  }

  private async invalidateWalletCache(userId: string) {
    await this.cacheManager.del(this.getWalletCacheKey(userId));
  }

  async deposit(userId: string, amount: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const balanceBefore = Number(wallet.balance);
      const balanceAfter = balanceBefore + amount;

      wallet.balance = balanceAfter;
      await queryRunner.manager.save(wallet);

      const transaction = queryRunner.manager.create(WalletTransaction, {
        walletId: wallet.id,
        type: TransactionType.DEPOSIT,
        amount,
        balanceBefore,
        balanceAfter,
        metadata: {
          description: 'Wallet deposit',
        },
      });

      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        message: 'Deposit successful',
        balance: balanceAfter,
        transaction: {
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          createdAt: transaction.createdAt,
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

  async withdraw(userId: string, amount: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const balanceBefore = Number(wallet.balance);

      if (balanceBefore < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      const balanceAfter = balanceBefore - amount;

      wallet.balance = balanceAfter;
      await queryRunner.manager.save(wallet);

      const transaction = queryRunner.manager.create(WalletTransaction, {
        walletId: wallet.id,
        type: TransactionType.WITHDRAW,
        amount,
        balanceBefore,
        balanceAfter,
        metadata: {
          description: 'Wallet withdrawal',
        },
      });

      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        message: 'Withdrawal successful',
        balance: balanceAfter,
        transaction: {
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          createdAt: transaction.createdAt,
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

  async getTransactions(userId: string) {
    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const transactions = await this.transactionRepository.find({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
    });

    return transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount),
      balanceBefore: Number(tx.balanceBefore),
      balanceAfter: Number(tx.balanceAfter),
      referenceId: tx.referenceId,
      metadata: tx.metadata,
      createdAt: tx.createdAt,
    }));
  }
}