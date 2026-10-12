import { Module } from '@nestjs/common';
import { PaymentInvariantService } from './payment-invariant.service';

@Module({
  providers: [PaymentInvariantService],
  exports: [PaymentInvariantService],
})
export class PaymentInvariantModule {}
