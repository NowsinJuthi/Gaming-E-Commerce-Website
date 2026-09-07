import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CartService } from './cart.service';
import { AddItemDto } from './dto/add-item.dto';
import { ApplyCodeDto } from './dto/apply-code.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentUser('id') userId: string) {
    return this.cart.getCart(userId);
  }

  @Post('items')
  addItem(@CurrentUser('id') userId: string, @Body() dto: AddItemDto) {
    return this.cart.addItem(userId, dto);
  }

  @Patch('items/:productId')
  updateItem(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.cart.updateItem(
      userId,
      productId,
      dto.quantity,
      dto.variationValueId,
    );
  }

  @Delete('items/:productId')
  removeItem(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @Query('variationValueId') variationValueId?: string,
  ) {
    return this.cart.removeItem(userId, productId, variationValueId);
  }

  @Delete()
  clear(@CurrentUser('id') userId: string) {
    return this.cart.clear(userId);
  }

  @Post('coupon')
  applyCoupon(@CurrentUser('id') userId: string, @Body() dto: ApplyCodeDto) {
    return this.cart.applyCoupon(userId, dto.code);
  }

  @Delete('coupon')
  removeCoupon(@CurrentUser('id') userId: string) {
    return this.cart.removeCoupon(userId);
  }

  @Post('voucher')
  applyVoucher(@CurrentUser('id') userId: string, @Body() dto: ApplyCodeDto) {
    return this.cart.applyVoucher(userId, dto.code);
  }

  @Delete('voucher')
  removeVoucher(@CurrentUser('id') userId: string) {
    return this.cart.removeVoucher(userId);
  }
}
