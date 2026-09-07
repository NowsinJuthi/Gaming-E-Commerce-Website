import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Role, ResellerOrderSource } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApplyResellerDto } from './dto/apply-reseller.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateWholesaleOrderDto } from './dto/create-wholesale-order.dto';
import { QueryResellersDto } from './dto/query-resellers.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { TopUpDto } from './dto/topup.dto';
import { UpdateResellerDto } from './dto/update-reseller.dto';
import { ResellerOrderService } from './reseller-order.service';
import { ResellerService } from './reseller.service';

@Controller('reseller')
export class ResellerController {
  constructor(
    private readonly reseller: ResellerService,
    private readonly orders: ResellerOrderService,
  ) {}

  // --- Account ---

  @Post('apply')
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyResellerDto,
  ) {
    return this.reseller.apply(user, dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.reseller.getMine(user);
  }

  @Get('balance')
  balance(@CurrentUser() user: AuthenticatedUser) {
    return this.reseller.getBalance(user);
  }

  @Get('prices')
  async myPrices(@CurrentUser() user: AuthenticatedUser) {
    const reseller = await this.reseller.getMine(user);
    return this.reseller.listPrices(String(reseller._id));
  }

  @Get('catalog')
  async catalog(@CurrentUser() user: AuthenticatedUser) {
    const reseller = await this.reseller.requireActive(user);
    return this.reseller.getCatalog(reseller);
  }

  // --- Wholesale orders (dashboard) ---

  @Post('orders')
  async createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWholesaleOrderDto,
  ) {
    const reseller = await this.reseller.requireActive(user);
    return this.orders.create(
      reseller,
      dto.items,
      ResellerOrderSource.Dashboard,
    );
  }

  @Get('orders')
  async listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    const reseller = await this.reseller.requireActive(user);
    return this.orders.list(reseller, pagination);
  }

  @Get('orders/:id')
  async getOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const reseller = await this.reseller.requireActive(user);
    return this.orders.getOne(reseller, id);
  }

  // --- API keys ---

  @Post('api-keys')
  async createApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    const reseller = await this.reseller.requireActive(user);
    return this.reseller.createApiKey(reseller, dto);
  }

  @Get('api-keys')
  async listApiKeys(@CurrentUser() user: AuthenticatedUser) {
    const reseller = await this.reseller.getMine(user);
    return this.reseller.listApiKeys(reseller);
  }

  @Delete('api-keys/:id')
  async revokeApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const reseller = await this.reseller.getMine(user);
    return this.reseller.revokeApiKey(reseller, id);
  }

  // --- Admin ---

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Get('admin/overview')
  adminOverview() {
    return this.reseller.adminOverview();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Get('admin/orders')
  adminOrders(
    @Query() pagination: PaginationDto,
    @Query('resellerId') resellerId?: string,
  ) {
    return this.orders.adminList(pagination, resellerId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Get('admin/resellers')
  adminList(@Query() query: QueryResellersDto) {
    return this.reseller.adminList(query, query.status, query.q);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Patch('admin/resellers/:id')
  adminUpdate(@Param('id') id: string, @Body() dto: UpdateResellerDto) {
    return this.reseller.adminUpdate(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Post('admin/resellers/:id/topup')
  adminTopUp(@Param('id') id: string, @Body() dto: TopUpDto) {
    return this.reseller.adminTopUp(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Get('admin/resellers/:id/api-keys')
  adminListApiKeys(@Param('id') id: string) {
    return this.reseller.adminListApiKeys(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Get('admin/resellers/:id/prices')
  adminListPrices(@Param('id') id: string) {
    return this.reseller.listPrices(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Put('admin/resellers/:id/prices')
  adminSetPrice(@Param('id') id: string, @Body() dto: SetPriceDto) {
    return this.reseller.setPrice(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Delete('admin/resellers/:id/prices/:productId')
  adminRemovePrice(
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    return this.reseller.removePrice(id, productId);
  }
}
