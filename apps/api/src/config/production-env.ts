const WEAK_SECRETS = new Set([
  'change-me',
  'change-me-access',
  'change-me-refresh',
  'secret',
  'password',
  'REPLACE_WITH_RANDOM_SECRET_MIN_32_CHARS',
  'REPLACE_WITH_ANOTHER_RANDOM_SECRET',
]);

export type ProductionEnvIssue = { key: string; reason: string };

function missing(key: string, value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

/**
 * Fail-closed production checks used by tests. Nest Joi remains the runtime
 * gate; this mirrors the required keys so they cannot silently regress.
 */
export function collectProductionEnvIssues(
  env: Record<string, unknown>,
): ProductionEnvIssue[] {
  const issues: ProductionEnvIssue[] = [];
  const nodeEnv = typeof env.NODE_ENV === 'string' ? env.NODE_ENV.trim() : '';
  if (!nodeEnv) {
    issues.push({
      key: 'NODE_ENV',
      reason: 'must be set; missing NODE_ENV is not treated as development',
    });
  } else if (nodeEnv !== 'production') {
    return issues;
  }

  const requireSecret = (key: string, min: number) => {
    const raw = env[key];
    if (missing(key, raw)) {
      issues.push({ key, reason: 'required in production' });
      return;
    }
    const value = String(raw).trim();
    if (value.length < min || WEAK_SECRETS.has(value)) {
      issues.push({ key, reason: 'too short or placeholder' });
    }
  };

  requireSecret('JWT_ACCESS_SECRET', 32);
  requireSecret('JWT_REFRESH_SECRET', 32);
  requireSecret('MFS_SMS_SYNC_TOKEN', 16);
  requireSecret('RECAPTCHA_SECRET', 16);
  requireSecret('RECAPTCHA_SITE_KEY', 10);
  requireSecret('LICENSE_SITE_SECRET', 16);
  requireSecret('DATA_ENCRYPTION_KEY', 16);

  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    issues.push({
      key: 'JWT_REFRESH_SECRET',
      reason: 'must differ from JWT_ACCESS_SECRET',
    });
  }
  if (env.REDIS_OPTIONAL === 'true') {
    issues.push({
      key: 'REDIS_OPTIONAL',
      reason: 'Redis cannot be optional in production',
    });
  }
  if (env.ALLOW_SANDBOX_INTEGRATIONS === 'true') {
    issues.push({
      key: 'ALLOW_SANDBOX_INTEGRATIONS',
      reason: 'sandbox integrations cannot be enabled in production',
    });
  }
  return issues;
}

export function isProductionNodeEnv(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'production';
}

export function assertProductionEnvironment(
  env: Record<string, unknown>,
): void {
  const issues = collectProductionEnvIssues(env);
  if (issues.length === 0) {
    return;
  }
  throw new Error(
    `Refusing to start: ${issues.map((issue) => `${issue.key}: ${issue.reason}`).join('; ')}`,
  );
}
