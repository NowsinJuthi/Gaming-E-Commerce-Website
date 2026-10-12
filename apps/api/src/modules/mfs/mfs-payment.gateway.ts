import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentGateway } from '../../common/enums';
import {
  CreateChargeInput,
  CreateChargeResult,
  NormalizedPaymentStatus,
  PaymentGatewayClient,
  RefundChargeInput,
  RefundChargeResult,
  VerifyResult,
  WebhookParseResult,
} from '../../integrations/payments/payment-gateway.interface';
import { MfsVerificationService } from './mfs-verification.service';

/** Internal manual MFS checkout — redirects to the storefront pay page. */
@Injectable()
export class MfsPaymentGateway implements PaymentGatewayClient {
  readonly gateway = PaymentGateway.Mfs;

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => MfsVerificationService))
    private readonly verification: MfsVerificationService,
  ) {}

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const appUrl =
      this.config.get<string>('payments.appUrl') ?? 'http://localhost:3000';
    const intentId = input.reference;
    return {
      gatewayRef: intentId,
      checkoutUrl: `${appUrl.replace(/\/$/, '')}/checkout/pay/${intentId}`,
      raw: { internal: true },
    };
  }

  async verify(gatewayRef: string): Promise<VerifyResult> {
    const status = await this.verification.getVerificationStatus(gatewayRef);
    return { status: status as NormalizedPaymentStatus };
  }

  async refundCharge(_input: RefundChargeInput): Promise<RefundChargeResult> {
    return { supported: false };
  }

  parseWebhook(payload: unknown): WebhookParseResult {
    const data =
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : {};
    return {
      gatewayRef: String(data.reference_id ?? data.invoice_id ?? ''),
      status: 'pending',
      signatureValid: true,
      raw: data,
    };
  }
}
