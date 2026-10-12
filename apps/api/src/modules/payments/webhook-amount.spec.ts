import { webhookAmountMatches } from './webhook-amount';

describe('webhookAmountMatches', () => {
  it('allows missing amount so gateways without a parsed amount still settle', () => {
    expect(webhookAmountMatches(undefined, 500)).toBe(true);
  });

  it('rejects a material mismatch', () => {
    expect(webhookAmountMatches(1, 500)).toBe(false);
  });

  it('allows tiny float drift', () => {
    expect(webhookAmountMatches(500.005, 500)).toBe(true);
  });
});
