import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '../../../common/enums';
import { isEphemeralGuestUser } from '../../../common/utils/guest-user';
import { UsersService } from '../../users/users.service';
import { accessTokenVersionMatches } from '../access-token-version';
import { ACCESS_COOKIE_NAME, readNamedCookie } from '../auth-cookies';
import type { AuthenticatedUser, JwtPayload } from '../auth.types';

/** Paymently sends the access token as a raw Authorization value or a token header. */
function readRawJwt(
  headers: Record<string, unknown> | undefined,
): string | null {
  if (!headers) return null;
  const tokenHeader = headers.token ?? headers.Token;
  const authorization = headers.authorization ?? headers.Authorization;
  const candidates = [tokenHeader, authorization];
  for (const candidate of candidates) {
    const value = Array.isArray(candidate) ? candidate[0] : candidate;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim().replace(/^bearer\s+/i, '');
    if (trimmed.split('.').length === 3) return trimmed;
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    const secret = config.get<string>('jwt.accessSecret');
    if (!secret) {
      throw new Error('JWT access secret is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: { headers?: Record<string, unknown> } | null) =>
          readRawJwt(req?.headers),
        (req: { headers?: { cookie?: string } } | null) =>
          readNamedCookie(req?.headers?.cookie, ACCESS_COOKIE_NAME) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Revalidates the token against the database on every request so that a
   * deleted/banned/suspended account loses access immediately (rather than
   * waiting for the token to expire), and so that the CURRENT roles from the
   * database are used instead of the potentially stale roles embedded in the
   * token at sign-in time.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }

    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }
    if (
      user.status === UserStatus.Banned ||
      user.status === UserStatus.Suspended
    ) {
      throw new UnauthorizedException('Account is not active');
    }
    if (!accessTokenVersionMatches(payload.ver, user.tokenVersion)) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    const isGuest = isEphemeralGuestUser(user);
    return {
      id: String(user._id),
      email: user.email,
      roles: user.roles,
      ...(isGuest ? { isGuest: true } : {}),
    };
  }
}
