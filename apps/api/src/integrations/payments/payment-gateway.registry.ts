import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common';
import { PaymentGateway } from '../../common/enums';
import { BkashGateway } from './gateways/bkash.gateway';
import { NagadGateway } from './gateways/nagad.gateway';
import { RocketGateway } from './gateways/rocket.gateway';
import { UddoktapayGateway } from './gateways/uddoktapay.gateway';
import { UpayGateway } from './gateways/upay.gateway';
import { MfsPaymentGateway } from '../../modules/mfs/mfs-payment.gateway';
import { PaymentGatewayClient } from './payment-gateway.interface';

/** Resolves a normalized gateway client from a {@link PaymentGateway} value. */
@Injectable()
export class PaymentGatewayRegistry {
  private readonly clients: Map<PaymentGateway, PaymentGatewayClient>;

  constructor(
    bkash: BkashGateway,
    nagad: NagadGateway,
    rocket: RocketGateway,
    upay: UpayGateway,
    uddoktapay: UddoktapayGateway,
    @Inject(forwardRef(() => MfsPaymentGateway))
    mfs: MfsPaymentGateway,
  ) {
    this.clients = new Map(
      [bkash, nagad, rocket, upay, uddoktapay, mfs].map((client) => [
        client.gateway,
        client,
      ]),
    );
  }

  get(gateway: PaymentGateway): PaymentGatewayClient {
    const client = this.clients.get(gateway);
    if (!client) {
      throw new BadRequestException(`Unsupported payment gateway: ${gateway}`);
    }
    return client;
  }
}
