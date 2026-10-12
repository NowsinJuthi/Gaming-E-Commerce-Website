/**
 * Synthetic supplier codes and fake payment checkout URLs are forbidden in
 * production. Non-production may enable them only with an explicit flag.
 */
export function isSandboxIntegrationsAllowed(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  flag: string | undefined = process.env.ALLOW_SANDBOX_INTEGRATIONS,
): boolean {
  if (nodeEnv === 'production') {
    return false;
  }
  return flag === 'true';
}

export class IntegrationNotConfiguredError extends Error {
  constructor(public readonly integration: string) {
    super(
      `${integration} is not configured. Live credentials are required in this environment.`,
    );
    this.name = 'IntegrationNotConfiguredError';
  }
}

/** Unconfigured integrations may use sandbox only when the explicit flag allows it. */
export function requireConfiguredOrSandbox(
  configured: boolean,
  name: string,
): void {
  if (configured) {
    return;
  }
  if (!isSandboxIntegrationsAllowed()) {
    throw new IntegrationNotConfiguredError(name);
  }
}
