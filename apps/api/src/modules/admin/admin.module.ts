import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../../database/schemas/order.schema';
import {
  SupplierOrder,
  SupplierOrderSchema,
} from '../../database/schemas/supplier-order.schema';
import {
  Supplier,
  SupplierSchema,
} from '../../database/schemas/supplier.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { Wallet, WalletSchema } from '../../database/schemas/wallet.schema';
import {
  DELIVERY_QUEUE,
  NOTIFICATIONS_QUEUE,
  ORDERS_QUEUE,
  PAYMENTS_QUEUE,
} from '../../queues/queue.constants';
import { EventsModule } from '../../shared/events/events.module';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminController } from './admin.controller';
import { ApiRouteMetricsService } from './api-route-metrics.service';
import { SystemStatusService } from './system-status.service';

@Module({
  imports: [
    DiscoveryModule,
    EventsModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: Supplier.name, schema: SupplierSchema },
      { name: SupplierOrder.name, schema: SupplierOrderSchema },
    ]),
    BullModule.registerQueue(
      { name: ORDERS_QUEUE },
      { name: PAYMENTS_QUEUE },
      { name: DELIVERY_QUEUE },
      { name: NOTIFICATIONS_QUEUE },
    ),
  ],
  controllers: [AdminController],
  providers: [AdminDashboardService, SystemStatusService, ApiRouteMetricsService],
  exports: [AdminDashboardService],
})
export class AdminModule {}
