import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ProductRequest,
  ProductRequestSchema,
} from '../../database/schemas/product-request.schema';
import { ProductRequestController } from './product-request.controller';
import { ProductRequestService } from './product-request.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductRequest.name, schema: ProductRequestSchema },
    ]),
  ],
  controllers: [ProductRequestController],
  providers: [ProductRequestService],
})
export class ProductRequestsModule {}
