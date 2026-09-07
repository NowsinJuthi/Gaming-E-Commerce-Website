import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentIntentStatus } from '../../common/enums';
import {
  PaymentIntent,
  PaymentIntentDocument,
} from '../../database/schemas/payment-intent.schema';
import {
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_GATEWAY_ORDER,
} from './payment-settings.constants';
import { PaymentSettingsService } from './payment-settings.service';

@Injectable()
export class PaymentAdminService {
  constructor(
    private readonly settings: PaymentSettingsService,
    @InjectModel(PaymentIntent.name)
    private readonly paymentModel: Model<PaymentIntentDocument>,
  ) {}

  async overview() {
    const effective = await this.settings.getEffective();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [intents24h, succeeded24h, failed24h] = await Promise.all([
      this.paymentModel.countDocuments({ createdAt: { $gte: since } }).exec(),
      this.paymentModel
        .countDocuments({
          status: PaymentIntentStatus.Succeeded,
          createdAt: { $gte: since },
        })
        .exec(),
      this.paymentModel
        .countDocuments({
          status: PaymentIntentStatus.Failed,
          createdAt: { $gte: since },
        })
        .exec(),
    ]);

    const gateways = PAYMENT_GATEWAY_ORDER.map((id) => {
      const entry = effective.gateways[id];
      const mode = !entry.enabled
        ? 'disabled'
        : entry.sandbox || !entry.configured
          ? 'sandbox'
          : 'live';
      return {
        id,
        label: PAYMENT_GATEWAY_LABELS[id],
        enabled: entry.enabled,
        configured: entry.configured,
        sandbox: entry.sandbox,
        mode,
      };
    });

    const configuredCount = gateways.filter((row) => row.configured).length;
    const enabledCount = gateways.filter((row) => row.enabled).length;
    const liveCount = gateways.filter((row) => row.mode === 'live').length;

    return {
      callbackBaseUrl: effective.callbackBaseUrl,
      appUrl: effective.appUrl,
      defaultGateway: effective.defaultGateway,
      configuredCount,
      enabledCount,
      liveCount,
      intents24h,
      succeeded24h,
      failed24h,
      gateways,
    };
  }
}
