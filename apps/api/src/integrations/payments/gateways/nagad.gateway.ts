import { Injectable } from '@nestjs/common';
import { PaymentGateway } from '../../../common/enums';
import { BasePaymentGateway } from '../base-payment.gateway';

/** Nagad merchant checkout. */
@Injectable()
export class NagadGateway extends BasePaymentGateway {
  readonly gateway = PaymentGateway.Nagad;
  protected readonly cfgKey = 'nagad';
  protected override readonly createPath = '/api/dfs/check-out/initialize';
  protected override readonly verifyPath = '/api/dfs/verify/payment';
}
