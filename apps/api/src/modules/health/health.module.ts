import { Module } from '@nestjs/common';
import { PaymentInvariantModule } from '../payments/payment-invariant.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PaymentInvariantModule],
  controllers: [HealthController],
})
export class HealthModule {}
