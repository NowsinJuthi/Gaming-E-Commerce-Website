import { resolvePaymentGatewayMode } from './payment-gateway-mode';

describe('payment gateway display mode', () => {
  it('fails closed in production when a live gateway is enabled but unconfigured', () => {
    expect(
      resolvePaymentGatewayMode({
        enabled: true,
        configured: false,
        sandbox: false,
        sandboxAllowed: false,
      }),
    ).toBe('misconfigured');
  });

  it('uses sandbox only when the explicit non-production flag is on', () => {
    expect(
      resolvePaymentGatewayMode({
        enabled: true,
        configured: false,
        sandbox: true,
        sandboxAllowed: true,
      }),
    ).toBe('sandbox');
  });

  it('ignores a stored sandbox flag when sandbox is not allowed', () => {
    expect(
      resolvePaymentGatewayMode({
        enabled: true,
        configured: true,
        sandbox: true,
        sandboxAllowed: false,
      }),
    ).toBe('live');
  });
});
