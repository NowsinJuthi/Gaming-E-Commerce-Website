import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DeliverySettings,
  DeliverySettingsSchema,
} from '../../database/schemas/delivery-settings.schema';
import { Order, OrderSchema } from '../../database/schemas/order.schema';
import {
  Product,
  ProductSchema,
} from '../../database/schemas/product.schema';
import {
  SupplierOrder,
  SupplierOrderSchema,
} from '../../database/schemas/supplier-order.schema';
import { DELIVERY_QUEUE } from '../../queues/queue.constants';
import { LicenseModule } from '../license/license.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { DeliveryAdminService } from './delivery-admin.service';
import { DeliveryController } from './delivery.controller';
import { DeliveryProcessor } from './delivery.processor';
import { DeliverySettingsService } from './delivery-settings.service';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeliverySettings.name, schema: DeliverySettingsSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: SupplierOrder.name, schema: SupplierOrderSchema },
    ]),
    BullModule.registerQueue({ name: DELIVERY_QUEUE }),
    LicenseModule,
    OrdersModule,
    SuppliersModule,
    NotificationsModule,
  ],
  controllers: [DeliveryController],
  providers: [
    DeliveryService,
    DeliveryProcessor,
    DeliveryAdminService,
    DeliverySettingsService,
  ],
  exports: [DeliveryService, DeliverySettingsService],
})
export class DeliveryModule {}
