import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../../database/schemas/inventory-item.schema';
import {
  Product,
  ProductSchema,
} from '../../database/schemas/product.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import {
  ResellerApiKey,
  ResellerApiKeySchema,
} from '../../database/schemas/reseller-api-key.schema';
import {
  ResellerOrder,
  ResellerOrderSchema,
} from '../../database/schemas/reseller-order.schema';
import {
  ResellerPrice,
  ResellerPriceSchema,
} from '../../database/schemas/reseller-price.schema';
import {
  Reseller,
  ResellerSchema,
} from '../../database/schemas/reseller.schema';
import { WalletModule } from '../wallet/wallet.module';
import { ResellerApiController } from './reseller-api.controller';
import { ResellerApiKeyGuard } from './reseller-api-key.guard';
import { ResellerOrderService } from './reseller-order.service';
import { ResellerController } from './reseller.controller';
import { ResellerService } from './reseller.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reseller.name, schema: ResellerSchema },
      { name: ResellerPrice.name, schema: ResellerPriceSchema },
      { name: ResellerApiKey.name, schema: ResellerApiKeySchema },
      { name: ResellerOrder.name, schema: ResellerOrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: User.name, schema: UserSchema },
    ]),
    WalletModule,
  ],
  controllers: [ResellerController, ResellerApiController],
  providers: [ResellerService, ResellerOrderService, ResellerApiKeyGuard],
  exports: [ResellerService],
})
export class ResellerModule {}
