import {
  IntegrationNotConfiguredError,
  isSandboxIntegrationsAllowed,
  requireConfiguredOrSandbox,
} from './sandbox-integrations';

describe('sandbox integrations', () => {
  it('fail-closes in production even when the flag is set', () => {
    expect(isSandboxIntegrationsAllowed('production', 'true')).toBe(false);
    expect(isSandboxIntegrationsAllowed('production', undefined)).toBe(false);
  });

  it('allows sandbox only in non-production with an explicit flag', () => {
    expect(isSandboxIntegrationsAllowed('development', 'true')).toBe(true);
    expect(isSandboxIntegrationsAllowed('test', 'true')).toBe(true);
    expect(isSandboxIntegrationsAllowed('development', undefined)).toBe(false);
    expect(isSandboxIntegrationsAllowed('development', 'false')).toBe(false);
  });

  it('describes a configuration error without a fake checkout URL', () => {
    const error = new IntegrationNotConfiguredError('bkash');
    expect(error.message).toMatch(/not configured/i);
    expect(error.message).not.toMatch(/sandbox/i);
    expect(error.message).not.toMatch(/http/i);
  });

  it('never falls through to synthetic fulfillment in production', () => {
    const previous = process.env.NODE_ENV;
    const previousFlag = process.env.ALLOW_SANDBOX_INTEGRATIONS;
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_SANDBOX_INTEGRATIONS = 'true';
    expect(() => requireConfiguredOrSandbox(false, 'codeswholesale')).toThrow(
      IntegrationNotConfiguredError,
    );
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_SANDBOX_INTEGRATIONS = 'true';
    expect(() => requireConfiguredOrSandbox(false, 'codeswholesale')).not.toThrow();
    process.env.NODE_ENV = previous;
    if (previousFlag === undefined) {
      delete process.env.ALLOW_SANDBOX_INTEGRATIONS;
    } else {
      process.env.ALLOW_SANDBOX_INTEGRATIONS = previousFlag;
    }
  });
});
