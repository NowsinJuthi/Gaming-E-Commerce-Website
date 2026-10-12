import {
  assertProductionEnvironment,
  collectProductionEnvIssues,
} from './production-env';

describe('production env fail-closed', () => {
  it('rejects missing NODE_ENV instead of defaulting to development', () => {
    const issues = collectProductionEnvIssues({});
    expect(issues.some((issue) => issue.key === 'NODE_ENV')).toBe(true);
  });

  it('does not require production secrets when NODE_ENV is development', () => {
    const issues = collectProductionEnvIssues({ NODE_ENV: 'development' });
    expect(issues).toEqual([]);
  });

  it('requires encryption, JWT, reCAPTCHA, MFS, license, and Redis in production', () => {
    const issues = collectProductionEnvIssues({
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'same-secret-value-must-be-32-chars!!',
      JWT_REFRESH_SECRET: 'same-secret-value-must-be-32-chars!!',
      REDIS_OPTIONAL: 'true',
      ALLOW_SANDBOX_INTEGRATIONS: 'true',
    });
    const keys = issues.map((issue) => issue.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'MFS_SMS_SYNC_TOKEN',
        'RECAPTCHA_SECRET',
        'RECAPTCHA_SITE_KEY',
        'LICENSE_SITE_SECRET',
        'DATA_ENCRYPTION_KEY',
        'JWT_REFRESH_SECRET',
        'REDIS_OPTIONAL',
        'ALLOW_SANDBOX_INTEGRATIONS',
      ]),
    );
    expect(() =>
      assertProductionEnvironment({ NODE_ENV: 'production' }),
    ).toThrow(/Refusing to start/);
    expect(() =>
      assertProductionEnvironment({ NODE_ENV: 'development' }),
    ).not.toThrow();
  });
});
