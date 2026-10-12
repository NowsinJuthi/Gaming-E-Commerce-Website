import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrderStatus, Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { shouldRevealDeliveredCodes } from '../../common/utils/order-access';
import type { OrderClientMeta } from '../../common/utils/order-client-meta';
import { resolveClientIp } from '../../security/security.types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateOrderDto } from './dto/create-order.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { SaveManualDeliveryDto } from './dto/manual-gift-card.dto';
import { OrderLockService } from './order-lock.service';
import { OrderService } from './order.service';
import { EmailSenderChannel } from '../../integrations/mail/email-settings.service';

const EMAIL_SENDER_CHANNELS: EmailSenderChannel[] = [
  'default', 'orders', 'support', 'system', 'admin',
];

class SendOrderNoteDto {
  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsIn(EMAIL_SENDER_CHANNELS)
  emailChannel?: EmailSenderChannel;
}

class AdminOrderListQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}

const headerValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

@Controller('orders')
export class OrderController {
  constructor(
    private readonly orders: OrderService,
    private readonly locks: OrderLockService,
  ) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrderDto,
    @Req() req: Request,
  ) {
    return this.orders.create(userId, dto, this.clientMeta(req));
  }

  @Post(':id/pay')
  pay(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.orders.pay(userId, id, this.clientMeta(req));
  }

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.orders.list(userId, pagination);
  }

  @Get('downloads')
  downloads(@CurrentUser('id') userId: string) {
    return this.orders.listDownloads(userId);
  }

  @Get('stats')
  stats(@CurrentUser('id') userId: string) {
    return this.orders.getCustomerStats(userId);
  }

  /** Guest receipt lookup — signed token only; never exposes full email. */
  @Public()
  @Get('guest/receipt')
  guestReceipt(@Query('token') token: string) {
    return this.orders.getGuestReceipt(token ?? '');
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Get('admin/list')
  adminList(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AdminOrderListQueryDto,
  ) {
    return this.orders.adminList({
      status: query.status,
      q: query.q,
      page: query.page,
      limit: query.limit,
      user,
    });
  }

  /** Aggregate order stats for a customer (admin order detail sidebar). */
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Get('admin/customer/:userId/stats')
  adminCustomerStats(@Param('userId') userId: string) {
    return this.orders.getCustomerStats(userId);
  }

  /** All currently active order edit locks. */
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Get('admin/locks')
  getAllLocks() {
    return this.locks.getAllLocks();
  }

  /** Acquire an edit lock before opening an order for editing. */
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @HttpCode(200)
  @Post(':id/lock')
  acquireLock(
    @Param('id') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('userName') userName: string,
  ) {
    const name = (userName ?? user.email).slice(0, 80);
    return this.locks.acquireLock(orderId, user.id, name);
  }

  /** Release the edit lock when leaving the order page. */
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @HttpCode(204)
  @Delete(':id/lock')
  releaseLock(
    @Param('id') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.locks.releaseLock(orderId, user.id);
  }

  /** Heartbeat: extend the lock TTL while the user stays on the order page. */
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @HttpCode(200)
  @Post(':id/lock/refresh')
  refreshLock(
    @Param('id') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.locks.refreshLock(orderId, user.id);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.getOne(user, id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (dto.giftCards?.length && !shouldRevealDeliveredCodes(user)) {
      throw new ForbiddenException('Access denied');
    }
    return this.orders.updateStatus(
      id,
      dto.status,
      dto.note,
      dto.deliveryMessage,
      dto.emailChannel,
      dto.giftCards,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Patch(':id/note')
  sendNote(@Param('id') id: string, @Body() dto: SendOrderNoteDto) {
    return this.orders.sendNote(id, dto.message, dto.emailChannel);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Patch(':id/manual-delivery')
  saveManualDelivery(
    @Param('id') id: string,
    @Body() dto: SaveManualDeliveryDto,
  ) {
    return this.orders.saveManualDelivery(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Post(':id/refund')
  refund(@Param('id') id: string, @Body() dto: RefundOrderDto) {
    return this.orders.requestRefund(id, dto.reason);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Post('admin/:id/restore')
  @HttpCode(200)
  adminRestore(@Param('id') id: string) {
    return this.orders.adminRestoreOrder(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Delete('admin/:id')
  @HttpCode(200)
  adminDelete(@Param('id') id: string) {
    return this.orders.adminDeleteOrder(id);
  }

  private clientMeta(req: Request): OrderClientMeta {
    return {
      customerIp: resolveClientIp(req),
      userAgent: headerValue(req.headers['user-agent']),
    };
  }
}
