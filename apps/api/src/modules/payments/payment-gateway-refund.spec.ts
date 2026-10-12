import { PaymentGateway } from '../../common/enums';
import {
  gatewayRefundPath,
  isConfirmedGatewayRefund,
} from './payment-gateway-refund';

describe('provider-specific gateway refunds', () => {
  it('does not use a generic /refund path for known providers', () => {
    expect(gatewayRefundPath(PaymentGateway.Bkash)).toBe(
      '/tokenized/checkout/payment/refund',
    );
    expect(gatewayRefundPath(PaymentGateway.Nagad)).toBe('/api/dfs/refund');
    expect(gatewayRefundPath(PaymentGateway.Rocket)).toBe('/payment/refund');
    expect(gatewayRefundPath(PaymentGateway.Upay)).toBe('/api/v1/refund');
    expect(gatewayRefundPath(PaymentGateway.UddoktaPay)).toBe(
      '/api/refund-payment',
    );
    expect(gatewayRefundPath(PaymentGateway.Mfs)).toBeNull();
    expect(gatewayRefundPath(PaymentGateway.Bkash)).not.toBe('/refund');
  });

  it('requires an explicit refund success status', () => {
    expect(isConfirmedGatewayRefund('pending')).toBe(false);
    expect(isConfirmedGatewayRefund('failed')).toBe(false);
    expect(isConfirmedGatewayRefund('refunded')).toBe(true);
    expect(isConfirmedGatewayRefund('succeeded')).toBe(true);
  });
});
