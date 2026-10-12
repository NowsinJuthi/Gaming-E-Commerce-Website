import { ConfigService } from '@nestjs/config';

/**
 * Guest receipt tokens are HMAC-signed. Never fall back to a public default.
 */
export function resolveGuestOrderAccessSecret(config: ConfigService): string {
  const secret = config.get<string>('jwt.accessSecret')?.trim();
  if (!secret) {
    throw new Error('jwt.accessSecret is required for guest order access tokens');
  }
  return secret;
}
