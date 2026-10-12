import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../../database/schemas/inventory-item.schema';
import { Order, OrderSchema } from '../../database/schemas/order.schema';
import {
  ResellerOrder,
  ResellerOrderSchema,
} from '../../database/schemas/reseller-order.schema';
import { CryptoService } from './crypto.service';
import { PlaintextSecretsService } from './plaintext-secrets.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: Order.name, schema: OrderSchema },
      { name: ResellerOrder.name, schema: ResellerOrderSchema },
    ]),
  ],
  providers: [CryptoService, PlaintextSecretsService],
  exports: [CryptoService, PlaintextSecretsService],
})
export class CryptoModule {}
