import { Injectable } from '@nestjs/common';
import { PaymentGateway } from '../../../common/enums';
import { GatewayConfig } from '../../../config/namespaces/payments.config';
import { BasePaymentGateway } from '../base-payment.gateway';
import { CreateChargeInput } from '../payment-gateway.interface';

type Json = Record<string, unknown>;

/**
 * UddoktaPay aggregator. A single integration exposes bKash/Nagad/Rocket/Upay
 * checkouts. Auth uses the `RT-UDDOKTAPAY-API-KEY` header; verification posts
 * the invoice id to `/api/verify-payment`.
 */
@Injectable()
export class UddoktapayGateway extends BasePaymentGateway {
  readonly gateway = PaymentGateway.UddoktaPay;
  protected readonly cfgKey = 'uddoktapay';
  protected override readonly createPath = '/api/checkout-v2';
  protected override readonly verifyPath = '/api/verify-payment';

  protected override authHeaders(cfg: GatewayConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'RT-UDDOKTAPAY-API-KEY': cfg.apiKey ?? '',
    };
  }

  protected override buildCreateBody(input: CreateChargeInput): Json {
    return {
      full_name: input.customer.name ?? 'Customer',
      email: input.customer.email ?? 'customer@example.com',
      amount: input.amount,
      metadata: { reference: input.reference, ...input.metadata },
      redirect_url: this.callbackUrl(),
      cancel_url: this.callbackUrl(),
      webhook_url: this.callbackUrl(),
    };
  }

  protected override buildVerifyBody(gatewayRef: string): Json {
    return { invoice_id: gatewayRef };
  }
}
