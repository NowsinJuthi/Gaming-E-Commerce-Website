import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CustomerPanelSettings,
  CustomerPanelSettingsSchema,
} from '../../database/schemas/customer-panel-settings.schema';
import {
  WishlistItem,
  WishlistItemSchema,
} from '../../database/schemas/wishlist-item.schema';
import { Order, OrderSchema } from '../../database/schemas/order.schema';
import { EventsModule } from '../../shared/events/events.module';
import { LicenseModule } from '../license/license.module';
import { CustomerPanelAdminController } from './customer-panel-admin.controller';
import { CustomerPanelAdminService } from './customer-panel-admin.service';
import { CustomerPanelController } from './customer-panel.controller';
import { CustomerPanelSettingsService } from './customer-panel-settings.service';
import { UploadsService } from '../../shared/uploads/uploads.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomerPanelSettings.name, schema: CustomerPanelSettingsSchema },
      { name: WishlistItem.name, schema: WishlistItemSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    EventsModule,
    LicenseModule,
  ],
  controllers: [CustomerPanelController, CustomerPanelAdminController],
  providers: [CustomerPanelSettingsService, CustomerPanelAdminService, UploadsService],
  exports: [CustomerPanelSettingsService],
})
export class CustomerPanelModule {}
