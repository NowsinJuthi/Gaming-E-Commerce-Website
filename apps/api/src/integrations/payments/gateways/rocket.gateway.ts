import { Injectable } from '@nestjs/common';
import { PaymentGateway } from '../../../common/enums';
import { BasePaymentGateway } from '../base-payment.gateway';

/** Rocket (Dutch-Bangla Mobile Banking) merchant checkout. */
@Injectable()
export class RocketGateway extends BasePaymentGateway {
  readonly gateway = PaymentGateway.Rocket;
  protected readonly cfgKey = 'rocket';
  protected override readonly createPath = '/payment/create';
  protected override readonly verifyPath = '/payment/verify';
  protected override readonly refundPath = '/payment/refund';
}
