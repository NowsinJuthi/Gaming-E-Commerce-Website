import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WishlistItem,
  WishlistItemDocument,
} from '../../database/schemas/wishlist-item.schema';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import { OrderStatus } from '../../common/enums';
import { CustomerPanelSettingsService } from './customer-panel-settings.service';

@Injectable()
export class CustomerPanelAdminService {
  constructor(
    private readonly settings: CustomerPanelSettingsService,
    @InjectModel(WishlistItem.name)
    private readonly wishlistModel: Model<WishlistItemDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {}

  async overview() {
    const config = await this.settings.getConfig();
    const [wishlistCount, deliveredOrders, activeOrders] = await Promise.all([
      this.wishlistModel.countDocuments().exec(),
      this.orderModel
        .countDocuments({ status: OrderStatus.Delivered })
        .exec(),
      this.orderModel
        .countDocuments({
          status: {
            $in: [
              OrderStatus.Pending,
              OrderStatus.Paid,
              OrderStatus.Processing,
            ],
          },
        })
        .exec(),
    ]);

    const enabledNav = Object.values(config.nav).filter(Boolean).length;

    return {
      storefront: config.storefront,
      nav: {
        enabledCount: enabledNav,
        total: Object.keys(config.nav).length,
        items: config.nav,
      },
      rewards: config.rewards,
      checkout: config.checkout,
      stats: {
        wishlistItems: wishlistCount,
        deliveredOrders,
        activeOrders,
      },
    };
  }
}
