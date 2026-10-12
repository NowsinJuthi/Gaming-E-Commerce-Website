import { PaymentGateway } from '../../common/enums';
import { gatewayRefMatchesIntent } from './payment-gateway-ref';

describe('findByGatewayRef ObjectId fallback', () => {
  it('never returns an intent that belongs to another gateway', () => {
    const nagadIntent = { gateway: PaymentGateway.Nagad };
    expect(
      gatewayRefMatchesIntent(nagadIntent, PaymentGateway.Nagad),
    ).toBe(true);
    expect(
      gatewayRefMatchesIntent(nagadIntent, PaymentGateway.Bkash),
    ).toBe(false);
    expect(gatewayRefMatchesIntent(null, PaymentGateway.Bkash)).toBe(false);
  });
});
