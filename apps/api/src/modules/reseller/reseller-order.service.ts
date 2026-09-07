import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import {
  DeliveryType,
  InventoryStatus,
  ProductStatus,
  ResellerOrderSource,
  ResellerOrderStatus,
  WalletTransactionType,
} from '../../common/enums';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../../database/schemas/inventory-item.schema';
import { round2 } from '../../common/utils/money';
import {
  Product,
  ProductDocument,
} from '../../database/schemas/product.schema';
import {
  ResellerOrder,
  ResellerOrderDocument,
  ResellerOrderItem,
} from '../../database/schemas/reseller-order.schema';
import type { ResellerDocument } from '../../database/schemas/reseller.schema';
import { WalletService } from '../wallet/wallet.service';
import { WholesaleOrderItemDto } from './dto/create-wholesale-order.dto';
import { ResellerService } from './reseller.service';

@Injectable()
export class ResellerOrderService {
  constructor(
    @InjectModel(ResellerOrder.name)
    private readonly orderModel: Model<ResellerOrderDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryModel: Model<InventoryItemDocument>,
    private readonly reseller: ResellerService,
    private readonly wallet: WalletService,
  ) {}

  async create(
    reseller: ResellerDocument,
    rawItems: WholesaleOrderItemDto[],
    source: ResellerOrderSource,
  ): Promise<ResellerOrderDocument> {
    const quantities = this.mergeQuantities(rawItems);
    const productIds = [...quantities.keys()].map((id) => new Types.ObjectId(id));

    const products = await this.productModel
      .find({ _id: { $in: productIds }, status: ProductStatus.Active })
      .exec();
    if (products.length !== quantities.size) {
      throw new BadRequestException(
        'One or more products are unavailable or invalid',
      );
    }

    const overrides = await this.reseller.getPriceOverrides(
      reseller._id,
      productIds,
    );

    const items: ResellerOrderItem[] = [];
    let total = 0;
    let currency = 'BDT';
    for (const product of products) {
      const productId = String(product._id);
      const quantity = quantities.get(productId) ?? 0;
      const available = product.stock?.available ?? 0;
      if (available < quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.title}`);
      }
      const unitPrice = this.reseller.resolveUnitPrice(
        reseller,
        product,
        overrides.get(productId),
      );
      const lineTotal = round2(unitPrice * quantity);
      total = round2(total + lineTotal);
      currency = product.pricing.currency;
      items.push({
        productId: product._id,
        title: product.title,
        quantity,
        unitPrice,
        lineTotal,
        deliveredCodes: [],
      });
    }

    if (total <= 0) {
      throw new BadRequestException('Order total must be positive');
    }

    const order = await this.orderModel.create({
      orderNumber: this.generateOrderNumber(),
      resellerId: reseller._id,
      userId: reseller.userId,
      items,
      total,
      currency,
      status: ResellerOrderStatus.Pending,
      source,
    });

    try {
      const txn = await this.wallet.debit({
        userId: reseller.userId,
        amount: total,
        type: WalletTransactionType.Purchase,
        reference: { type: 'reseller_order', id: order._id },
        idempotencyKey: `rsorder:${String(order._id)}`,
        description: `Wholesale order ${order.orderNumber}`,
        notify: false,
      });
      order.walletTransactionId = txn._id;
      try {
        await this.fulfillOrder(order, products);
        order.status = ResellerOrderStatus.Completed;
        await order.save();
      } catch (fulfillError) {
        await this.wallet.refund({
          userId: reseller.userId,
          amount: total,
          reference: { type: 'reseller_order_refund', id: order._id },
          idempotencyKey: `rsrefund:${String(order._id)}`,
          description: `Refund for failed wholesale order ${order.orderNumber}`,
          notify: false,
        });
        order.status = ResellerOrderStatus.Cancelled;
        await order.save();
        throw fulfillError;
      }
    } catch (error) {
      if (!order.walletTransactionId) {
        order.status = ResellerOrderStatus.Cancelled;
        await order.save();
      }
      throw error;
    }

    await this.reseller.incrementOrderStats(reseller._id, total);

    return order;
  }

  adminList(
    pagination: PaginationDto,
    resellerId?: string,
  ): Promise<PaginatedResult<ResellerOrderDocument>> {
    const filter: Record<string, Types.ObjectId> = {};
    if (resellerId) {
      filter.resellerId = new Types.ObjectId(resellerId);
    }
    const { page, limit } = pagination;
    return Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]).then(([items, total]) => ({ items, total, page, limit }));
  }

  async list(
    reseller: ResellerDocument,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<ResellerOrderDocument>> {
    const filter = { resellerId: reseller._id };
    const { page, limit } = pagination;
    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit };
  }

  async getOne(
    reseller: ResellerDocument,
    orderId: string,
  ): Promise<ResellerOrderDocument> {
    const order = await this.orderModel
      .findOne({ _id: new Types.ObjectId(orderId), resellerId: reseller._id })
      .exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private mergeQuantities(
    rawItems: WholesaleOrderItemDto[],
  ): Map<string, number> {
    const quantities = new Map<string, number>();
    for (const item of rawItems) {
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    }
    return quantities;
  }

  private async fulfillOrder(
    order: ResellerOrderDocument,
    products: ProductDocument[],
  ): Promise<void> {
    const productMap = new Map(products.map((p) => [String(p._id), p]));
    for (const item of order.items) {
      const product = productMap.get(String(item.productId));
      if (!product) {
        continue;
      }
      if (product.deliveryType === DeliveryType.Auto) {
        const claimed: Types.ObjectId[] = [];
        for (let i = 0; i < item.quantity; i += 1) {
          const unit = await this.inventoryModel
            .findOneAndUpdate(
              {
                productId: item.productId,
                status: InventoryStatus.Available,
              },
              {
                $set: {
                  status: InventoryStatus.Sold,
                  soldAt: new Date(),
                  orderId: order._id,
                },
              },
              { new: true },
            )
            .select('+value')
            .exec();
          if (!unit) {
            break;
          }
          claimed.push(unit._id);
          item.deliveredCodes.push({ code: unit.value });
        }
        if (claimed.length < item.quantity) {
          throw new BadRequestException(
            `Insufficient inventory for ${item.title}`,
          );
        }
        await this.productModel
          .updateOne(
            { _id: item.productId },
            {
              $inc: {
                'stock.available': -item.quantity,
                'stock.sold': item.quantity,
              },
            },
          )
          .exec();
      } else {
        const result = await this.productModel
          .updateOne(
            {
              _id: item.productId,
              'stock.available': { $gte: item.quantity },
            },
            {
              $inc: {
                'stock.available': -item.quantity,
                'stock.sold': item.quantity,
              },
            },
          )
          .exec();
        if (result.modifiedCount === 0) {
          throw new BadRequestException(`Insufficient stock for ${item.title}`);
        }
      }
    }
  }

  private generateOrderNumber(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const random = randomBytes(2).toString('hex').toUpperCase();
    return `WS-${stamp}-${random}`;
  }
}
