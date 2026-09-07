import { PaymentGateway } from '../../common/enums';

export type NormalizedPaymentStatus = 'pending' | 'succeeded' | 'failed';

export interface CreateChargeInput {
  /** Our internal PaymentIntent id; echoed back by the gateway. */
  reference: string;
  amount: number;
  currency: string;
  customer: { id: string; email?: string; name?: string };
  metadata?: Record<string, unknown>;
}

export interface CreateChargeResult {
  gatewayRef: string;
  checkoutUrl?: string;
  raw?: unknown;
}

export interface VerifyResult {
  status: NormalizedPaymentStatus;
  amount?: number;
  raw?: unknown;
}

export interface WebhookParseResult {
  gatewayRef: string;
  status: NormalizedPaymentStatus;
  amount?: number;
  signatureValid: boolean;
  raw?: unknown;
}

/**
 * Anti-corruption layer: every payment provider is normalized behind this
 * interface so the Payment module never depends on a specific vendor's API.
 */
export interface PaymentGatewayClient {
  readonly gateway: PaymentGateway;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  verify(gatewayRef: string): Promise<VerifyResult>;
  parseWebhook(
    payload: unknown,
    signature: string | undefined,
    rawBody?: Buffer,
  ): WebhookParseResult;
}
