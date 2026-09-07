import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '../../common/enums';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import { CustomerPanelSettingsService } from '../customer-panel/customer-panel-settings.service';

@Injectable()
export class RewardsService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly panelSettings: CustomerPanelSettingsService,
  ) {}

  async getSummary(userId: string) {
    const config = await this.panelSettings.getConfig();
    const rate = config.rewards.pointsPerCurrency;

    const orders = await this.orderModel
      .find({
        userId: new Types.ObjectId(userId),
        status: OrderStatus.Delivered,
      })
      .select('orderNumber pricing.total createdAt')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
      .exec();

    let lifetimePoints = 0;
    const history: Array<{
      orderId: string;
      orderNumber?: string;
      points: number;
      total: number;
      createdAt?: Date;
    }> = [];

    for (const order of orders) {
      const total = order.pricing?.total ?? 0;
      const points = Math.floor(total * rate);
      lifetimePoints += points;
      history.push({
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        points,
        total,
        createdAt: order.createdAt,
      });
    }

    const redeemThreshold = config.rewards.redeemThreshold;
    const progress = Math.min(
      100,
      Math.round((lifetimePoints / redeemThreshold) * 100),
    );

    return {
      enabled: config.rewards.enabled,
      points: lifetimePoints,
      lifetimePoints,
      pointsPerCurrency: rate,
      redeemThreshold,
      redeemProgress: progress,
      canRedeem: lifetimePoints >= redeemThreshold,
      history: history.slice(0, 20),
    };
  }
}
