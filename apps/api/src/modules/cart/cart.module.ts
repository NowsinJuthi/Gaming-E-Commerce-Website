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
import { CouponsModule } from '../coupons/coupons.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: User.name, schema: UserSchema },
    ]),
    CouponsModule,
    VouchersModule,
    RolePermissionsModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
