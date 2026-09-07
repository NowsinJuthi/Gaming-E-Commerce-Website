import { Module, forwardRef } from '@nestjs/common';
import { BkashGateway } from './gateways/bkash.gateway';
import { NagadGateway } from './gateways/nagad.gateway';
import { RocketGateway } from './gateways/rocket.gateway';
import { UddoktapayGateway } from './gateways/uddoktapay.gateway';
import { UpayGateway } from './gateways/upay.gateway';
import { PaymentGatewayRegistry } from './payment-gateway.registry';
import { PaymentSettingsModule } from '../../modules/payments/payment-settings.module';
import { MfsModule } from '../../modules/mfs/mfs.module';

/**
 * Provides every payment-gateway adapter behind a single registry. Credentials
 * resolve from admin payment settings with environment fallbacks.
 */
@Module({
  imports: [PaymentSettingsModule, forwardRef(() => MfsModule)],
  providers: [
    BkashGateway,
    NagadGateway,
    RocketGateway,
    UpayGateway,
    UddoktapayGateway,
    PaymentGatewayRegistry,
  ],
  exports: [PaymentGatewayRegistry],
})
export class PaymentsIntegrationModule {}
