import {
  publicLivenessBody,
  publicReadinessOkBody,
  publicReadinessRequiresPayments,
  publicReadinessUnavailableBody,
} from './health-public';

describe('public health bodies', () => {
  it('does not disclose uptime, paths, or infrastructure flags', () => {
    expect(publicLivenessBody()).toEqual({ status: 'ok' });
    expect(publicReadinessOkBody()).toEqual({ status: 'ok' });
    expect(publicReadinessUnavailableBody()).toEqual({ status: 'unavailable' });
    expect(JSON.stringify(publicLivenessBody())).not.toMatch(/uptime|node|cwd|redis|mongo/i);
  });

  it('fails production readiness when the payment unique index is not ready', () => {
    expect(
      publicReadinessRequiresPayments({
        production: true,
        paymentsReady: false,
      }),
    ).toBe(false);
    expect(
      publicReadinessRequiresPayments({
        production: true,
        paymentsReady: true,
      }),
    ).toBe(true);
    expect(
      publicReadinessRequiresPayments({
        production: false,
        paymentsReady: false,
      }),
    ).toBe(true);
  });
});
