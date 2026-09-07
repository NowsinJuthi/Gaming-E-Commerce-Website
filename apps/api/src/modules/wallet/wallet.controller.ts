import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminCreditDto } from './dto/admin-credit.dto';
import { ProcessWithdrawalDto } from './dto/process-withdrawal.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  getWallet(@CurrentUser('id') userId: string) {
    return this.wallet.getWallet(userId);
  }

  @Get('transactions')
  transactions(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.wallet.listTransactions(userId, pagination);
  }

  @Post('withdraw')
  withdraw(@CurrentUser('id') userId: string, @Body() dto: WithdrawDto) {
    return this.wallet.requestWithdrawal(userId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Post('credit')
  credit(@Body() dto: AdminCreditDto) {
    return this.wallet.adminCredit({
      userId: dto.userId,
      amount: dto.amount,
      type: dto.type,
      description: dto.description,
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Post('withdrawals/:id/process')
  process(@Param('id') id: string, @Body() dto: ProcessWithdrawalDto) {
    return this.wallet.processWithdrawal(id, dto.approve, dto.note);
  }
}
