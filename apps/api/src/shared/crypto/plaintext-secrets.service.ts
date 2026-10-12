import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../../database/schemas/inventory-item.schema';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import {
  ResellerOrder,
  ResellerOrderDocument,
} from '../../database/schemas/reseller-order.schema';
import {
  PLAINTEXT_ORDER_SECRET_FIELDS,
  PLAINTEXT_RESELLER_SECRET_FIELDS,
  plaintextSecretFieldFilter,
  plaintextSecretOrFilter,
  shouldFailClosedOnLegacyPlaintext,
  sumPlaintextCounts,
  type PlaintextSecretCounts,
} from './plaintext-secrets';

@Injectable()
export class PlaintextSecretsService implements OnModuleInit {
  private readonly logger = new Logger(PlaintextSecretsService.name);

  constructor(
    @InjectModel(InventoryItem.name)
    private readonly inventoryModel: Model<InventoryItemDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(ResellerOrder.name)
    private readonly resellerOrderModel: Model<ResellerOrderDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const counts = await this.countLegacyPlaintext();
    const total = sumPlaintextCounts(counts);
    if (total <= 0) {
      return;
    }
    const summary =
      `legacy plaintext remaining inventory=${counts.inventoryItems} ` +
      `orders=${counts.orderDeliveredCodes} reseller=${counts.resellerOrderCodes}`;
    this.logger.error(summary);
    if (shouldFailClosedOnLegacyPlaintext(process.env, total)) {
      throw new Error(
        `Refusing to start: ${summary}. Run migrate:encrypt-codes --apply or set ALLOW_LEGACY_PLAINTEXT_SECRETS=true during migration.`,
      );
    }
  }

  async countLegacyPlaintext(): Promise<PlaintextSecretCounts> {
    const [inventoryItems, orderDeliveredCodes, resellerOrderCodes] =
      await Promise.all([
        this.inventoryModel
          .countDocuments(plaintextSecretFieldFilter('value'))
          .exec(),
        this.orderModel
          .countDocuments(plaintextSecretOrFilter(PLAINTEXT_ORDER_SECRET_FIELDS))
          .exec(),
        this.resellerOrderModel
          .countDocuments(plaintextSecretOrFilter(PLAINTEXT_RESELLER_SECRET_FIELDS))
          .exec(),
      ]);
    return { inventoryItems, orderDeliveredCodes, resellerOrderCodes };
  }
}
