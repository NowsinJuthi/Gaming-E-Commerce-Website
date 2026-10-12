import { PaymentGateway } from '../../common/enums';
import type { NormalizedPaymentStatus } from '../../integrations/payments/payment-gateway.interface';

/** Provider-specific refund/void paths. Generic `/refund` is not treated as confirmed. */
export const PAYMENT_GATEWAY_REFUND_PATH: Record<PaymentGateway, string | null> = {
  [PaymentGateway.Bkash]: '/tokenized/checkout/payment/refund',
  [PaymentGateway.Nagad]: '/api/dfs/refund',
  [PaymentGateway.Rocket]: '/payment/refund',
  [PaymentGateway.Upay]: '/api/v1/refund',
  [PaymentGateway.UddoktaPay]: '/api/refund-payment',
  [PaymentGateway.Mfs]: null,
};

export function gatewayRefundPath(gateway: PaymentGateway): string | null {
  return PAYMENT_GATEWAY_REFUND_PATH[gateway] ?? null;
}

/** Only an explicit success/refunded status confirms a void. Pending is not enough. */
export function isConfirmedGatewayRefund(
  status: NormalizedPaymentStatus | string | undefined,
): boolean {
  const v = (status ?? '').toLowerCase();
  return (
    v === 'succeeded' ||
    v === 'success' ||
    v === 'completed' ||
    v === 'complete' ||
    v === 'paid' ||
    v === 'approved' ||
    v === 'refunded' ||
    v === 'voided'
  );
}
