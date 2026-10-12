import { Injectable } from '@nestjs/common';
import { PaymentGateway } from '../../../common/enums';
import { BasePaymentGateway } from '../base-payment.gateway';

/** Upay merchant checkout. */
@Injectable()
export class UpayGateway extends BasePaymentGateway {
  readonly gateway = PaymentGateway.Upay;
  protected readonly cfgKey = 'upay';
  protected override readonly createPath = '/api/v1/checkout';
  protected override readonly verifyPath = '/api/v1/verify';
  protected override readonly refundPath = '/api/v1/refund';
}
