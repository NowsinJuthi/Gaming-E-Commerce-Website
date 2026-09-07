import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../../database/schemas/inventory-item.schema';
import { Order, OrderSchema } from '../../database/schemas/order.schema';
import {
  Product,
  ProductSchema,
} from '../../database/schemas/product.schema';
import { BrandsModule } from '../brands/brands.module';
import { CategoriesModule } from '../categories/categories.module';
import { UploadsService } from '../../shared/uploads/uploads.service';
import { EventsModule } from '../../shared/events/events.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { StockService } from './stock.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    CategoriesModule,
    BrandsModule,
    EventsModule,
  ],
  controllers: [ProductController],
  providers: [ProductService, StockService, UploadsService],
  exports: [ProductService, StockService],
})
export class ProductsModule {}
