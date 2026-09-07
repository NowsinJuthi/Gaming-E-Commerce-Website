import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../../database/schemas/inventory-item.schema';
import { Order, OrderSchema } from '../../database/schemas/order.schema';
import {
  SequenceCounter,
  SequenceCounterSchema,
} from '../../database/schemas/sequence-counter.schema';
import {
  Product,
  ProductSchema,
} from '../../database/schemas/product.schema';
import {
  PaymentIntent,
  PaymentIntentSchema,
} from '../../database/schemas/payment-intent.schema';
import {
  SmsLog,
  SmsLogSchema,
} from '../../database/schemas/sms-log.schema';
import {
  User,
  UserSchema,
} from '../../database/schemas/user.schema';
import { DELIVERY_QUEUE, ORDERS_QUEUE } from '../../queues/queue.constants';
import { CartModule } from '../cart/cart.module';
import { CouponsModule } from '../coupons/coupons.module';
import { CustomerPanelModule } from '../customer-panel/customer-panel.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { WalletModule } from '../wallet/wallet.module';
import { UsersModule } from '../users/users.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { EventsModule } from '../../shared/events/events.module';
import { OrderController } from './order.controller';
import { OrderLockService } from './order-lock.service';
import { OrderProcessor } from './order.processor';
import { OrderService } from './order.service';
import { CustomerOrderMailService } from './customer-order-mail.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: SequenceCounter.name, schema: SequenceCounterSchema },
      { name: User.name, schema: UserSchema },
      { name: PaymentIntent.name, schema: PaymentIntentSchema },
      { name: SmsLog.name, schema: SmsLogSchema },
    ]),
    BullModule.registerQueue({ name: ORDERS_QUEUE }, { name: DELIVERY_QUEUE }),
    CartModule,
    CouponsModule,
    CustomerPanelModule,
    VouchersModule,
    NotificationsModule,
    WalletModule,
    UsersModule,
    AffiliateModule,
    RolePermissionsModule,
    EventsModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderProcessor, OrderLockService, CustomerOrderMailService],
  exports: [OrderService],
})
export class OrdersModule {}
