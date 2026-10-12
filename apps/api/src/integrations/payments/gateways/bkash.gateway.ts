import { Injectable } from '@nestjs/common';
import { PaymentGateway } from '../../../common/enums';
import { GatewayConfig } from '../../../config/namespaces/payments.config';
import { BasePaymentGateway } from '../base-payment.gateway';

/**
 * bKash Tokenized Checkout (PGW). Real integration performs a grant-token
 * handshake; the token is sent as `Authorization` alongside `X-APP-Key`.
 */
@Injectable()
export class BkashGateway extends BasePaymentGateway {
  readonly gateway = PaymentGateway.Bkash;
  protected readonly cfgKey = 'bkash';
  protected override readonly createPath = '/tokenized/checkout/create';
  protected override readonly verifyPath = '/tokenized/checkout/payment/status';
  protected override readonly refundPath =
    '/tokenized/checkout/payment/refund';

  protected override authHeaders(cfg: GatewayConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-APP-Key': cfg.apiKey ?? '',
      Authorization: cfg.apiSecret ?? '',
    };
  }
}
