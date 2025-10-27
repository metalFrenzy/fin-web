import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transactions.entity';
import { TransactionType } from 'src/common/enum/transaction-type.enum';

@Injectable()
export class WalletService {
    constructor(
        @InjectRepository(Wallet) private walletRepository: Repository<Wallet>,
        @InjectRepository(WalletTransaction) private walletTransactionRepositroy: Repository<WalletTransaction>,
        private dataSource: DataSource
    ) { }

    async getWalletByUserId(userId: string) {
        const wallet = await this.walletRepository.findOne({ where: { userId } })

        if (!wallet) {
            throw new NotFoundException('Wallet not found');
        }
        return {
            id: wallet.id,
            balance: wallet.balance,
            userId: wallet.userId
        }
    }

    async deposit(userId: string, amount: number) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const wallet = await queryRunner.manager.findOne(Wallet, { where: { userId }, lock: { mode: "pessimistic_write" } });
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
                    description: 'Wallet deposit'
                }
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
            const wallet = await queryRunner.manager.findOne(Wallet, { where: { userId }, lock: { mode: "pessimistic_write" } });
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
                    description: 'Wallet withdraw'
                }
            });


            await queryRunner.manager.save(transaction);
            await queryRunner.commitTransaction();
            return {
                message: 'Withdraw successful',
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

        const transactions = await this.walletTransactionRepositroy.find({
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
