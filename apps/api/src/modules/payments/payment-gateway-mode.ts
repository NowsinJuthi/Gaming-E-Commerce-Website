export type PaymentGatewayDisplayMode =
  | 'live'
  | 'sandbox'
  | 'disabled'
  | 'misconfigured';

/** Live-enabled but unconfigured gateways are sandbox only when explicitly allowed. */
export function resolvePaymentGatewayMode(input: {
  enabled: boolean;
  configured: boolean;
  sandbox: boolean;
  sandboxAllowed: boolean;
}): PaymentGatewayDisplayMode {
  if (!input.enabled) {
    return 'disabled';
  }
  if (!input.configured) {
    return input.sandboxAllowed ? 'sandbox' : 'misconfigured';
  }
  if (input.sandbox && input.sandboxAllowed) {
    return 'sandbox';
  }
  return 'live';
}
