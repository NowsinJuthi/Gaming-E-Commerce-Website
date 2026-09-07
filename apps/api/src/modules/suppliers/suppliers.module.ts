import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SupplierOrder,
  SupplierOrderSchema,
} from '../../database/schemas/supplier-order.schema';
import {
  SupplierProduct,
  SupplierProductSchema,
} from '../../database/schemas/supplier-product.schema';
import {
  Supplier,
  SupplierSchema,
} from '../../database/schemas/supplier.schema';
import { SuppliersIntegrationModule } from '../../integrations/suppliers/suppliers-integration.module';
import { SupplierController } from './supplier.controller';
import { SupplierFulfillmentService } from './supplier-fulfillment.service';
import { SupplierService } from './supplier.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Supplier.name, schema: SupplierSchema },
      { name: SupplierProduct.name, schema: SupplierProductSchema },
      { name: SupplierOrder.name, schema: SupplierOrderSchema },
    ]),
    SuppliersIntegrationModule,
  ],
  controllers: [SupplierController],
  providers: [SupplierService, SupplierFulfillmentService],
  exports: [SupplierFulfillmentService, SupplierService],
})
export class SuppliersModule {}
