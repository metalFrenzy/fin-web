import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorators';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(@CurrentUser() user: any) {
    return this.walletService.getWalletByUserId(user.id);
  }

  @Post('deposit')
  @HttpCode(HttpStatus.OK)
  async deposit(@CurrentUser() user: any, @Body() depositDto: DepositDto) {
    return this.walletService.deposit(user.id, depositDto.amount);
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.OK)
  async withdraw(@CurrentUser() user: any, @Body() withdrawDto: WithdrawDto) {
    return this.walletService.withdraw(user.id, withdrawDto.amount);
  }

  @Get('transactions')
  async getTransactions(@CurrentUser() user: any) {
    return this.walletService.getTransactions(user.id);
  }
}