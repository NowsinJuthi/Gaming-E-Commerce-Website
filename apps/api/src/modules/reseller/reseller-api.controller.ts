import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ResellerOrderSource } from '../../common/enums';
import type { ResellerDocument } from '../../database/schemas/reseller.schema';
import { WalletService } from '../wallet/wallet.service';
import { CurrentReseller } from './current-reseller.decorator';
import { CreateWholesaleOrderDto } from './dto/create-wholesale-order.dto';
import { ResellerApiKeyGuard } from './reseller-api-key.guard';
import { ResellerOrderService } from './reseller-order.service';
import { ResellerService } from './reseller.service';

/**
 * Programmatic reseller API authenticated via the `x-api-key` header. Marked
 * @Public so the global JWT guard is skipped; the API-key guard authenticates.
 */
@Public()
@UseGuards(ResellerApiKeyGuard)
@Controller('reseller/api')
export class ResellerApiController {
  constructor(
    private readonly orders: ResellerOrderService,
    private readonly wallet: WalletService,
    private readonly reseller: ResellerService,
  ) {}

  @Get('me')
  me(@CurrentReseller() reseller: ResellerDocument) {
    return reseller;
  }

  @Get('balance')
  balance(@CurrentReseller() reseller: ResellerDocument) {
    return this.wallet.getWallet(String(reseller.userId));
  }

  @Get('catalog')
  catalog(@CurrentReseller() reseller: ResellerDocument) {
    return this.reseller.getCatalog(reseller);
  }

  @Post('orders')
  createOrder(
    @CurrentReseller() reseller: ResellerDocument,
    @Body() dto: CreateWholesaleOrderDto,
  ) {
    return this.orders.create(reseller, dto.items, ResellerOrderSource.Api);
  }

  @Get('orders')
  listOrders(
    @CurrentReseller() reseller: ResellerDocument,
    @Query() pagination: PaginationDto,
  ) {
    return this.orders.list(reseller, pagination);
  }

  @Get('orders/:id')
  getOrder(
    @CurrentReseller() reseller: ResellerDocument,
    @Param('id') id: string,
  ) {
    return this.orders.getOne(reseller, id);
  }
}
