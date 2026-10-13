import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, SupplierOrderStatus } from '../../common/enums';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import {
  Product,
  ProductDocument,
} from '../../database/schemas/product.schema';
import { OrderService } from '../orders/order.service';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { SupplierFulfillmentService } from '../suppliers/supplier-fulfillment.service';

/**
 * Auto-delivery pipeline (Payment → Queue → Supplier → Delivery → Notification).
 * Invoked by the BullMQ DeliveryProcessor for each paid order. Procures each
 * line from suppliers (with failover handled inside the supplier service),
 * hands the codes to the order, and delegates finalization/notification to the
 * order service. Lines without a supplier offering fall back to local stock.
 */
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly orders: OrderService,
    private readonly suppliers: SupplierFulfillmentService,
    private readonly crypto: CryptoService,
  ) {}

  async deliverOrder(orderId: string): Promise<void> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order || order.status === OrderStatus.Delivered) {
      return;
    }
    if (
      order.status !== OrderStatus.Paid &&
      order.status !== OrderStatus.Processing
    ) {
      this.logger.warn(
        `Order ${orderId} not deliverable in status ${order.status}`,
      );
      return;
    }

    const allAlreadyDelivered = order.items.every((item) => item.delivered);
    if (allAlreadyDelivered) {
      await this.orders.concludeSupplierDelivery(String(order._id));
      return;
    }

    let needsLocalFallback = false;
    let supplierDelivered = false;

    for (let index = 0; index < order.items.length; index += 1) {
      const item = order.items[index];
      if (!item || item.delivered) {
        continue;
      }

      const hasSupplier = await this.suppliers.hasOffering(
        String(item.productId),
      );
      if (!hasSupplier) {
        needsLocalFallback = true;
        continue;
      }

      // --- Supplier stage: failover across suppliers happens inside fulfill().
      const outcome = await this.suppliers.fulfill({
        productId: String(item.productId),
        quantity: item.quantity,
        orderId: String(order._id),
        idempotencyKey: `order:${String(order._id)}:item:${index}`,
      });

      if (outcome.status !== SupplierOrderStatus.Success) {
        // Not yet in hand (async/pending) — throw so BullMQ retries.
        throw new Error(
          `Supplier delivery incomplete for item ${index} (${outcome.status})`,
        );
      }

      // --- Delivery stage: attach codes + move stock reserved -> sold.
      item.deliveredCodes = outcome.codes.map((c) =>
        this.crypto.sealDeliveredSecret({
          code: c.code,
          serial: c.serial,
          pin: c.pin,
        }),
      );
      item.supplierOrderId = new Types.ObjectId(outcome.supplierOrderId);
      item.deliverySource = 'supplier';
      item.delivered = true;
      await this.productModel
        .updateOne(
          { _id: item.productId },
          {
            $inc: {
              'stock.reserved': -item.quantity,
              'stock.sold': item.quantity,
            },
          },
        )
        .exec();
      supplierDelivered = true;
    }

    this.orders.rememberGiftCodeHashes(order);
    await order.save();

    const allDelivered = order.items.every((item) => item.delivered);

    // Finalization + notification — also reconciles stuck orders (all lines delivered).
    if (allDelivered) {
      await this.orders.concludeSupplierDelivery(String(order._id));
    } else if (needsLocalFallback) {
      // Local-inventory path also redeems promotions, finalizes and notifies.
      await this.orders.processFulfillment(String(order._id));
    } else if (supplierDelivered) {
      await this.orders.concludeSupplierDelivery(String(order._id));
    }
  }

  /** Called when the retry budget is exhausted: flag + notify, keep for ops. */
  async handleExhausted(orderId: string, error: string): Promise<void> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      return;
    }
    this.orders.appendTimelineEntry(
      order,
      order.status,
      `Auto-delivery failed: ${error}`,
    );
    await order.save();
    this.logger.error(
      `Auto-delivery exhausted for order ${orderId}: ${error}`,
    );
  }
}
