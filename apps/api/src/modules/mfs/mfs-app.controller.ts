import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { LONG_SESSION_TTL_SECONDS } from '../../config/session-ttl';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { isAdministratorRole, isChatStaff } from '../../common/utils/role.utils';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from '../auth/auth.service';
import type { AuthResult, AuthTokens } from '../auth/auth.types';
import { UsersService } from '../users/users.service';
import { MfsVerificationService } from './mfs-verification.service';

/** Legacy app sends device metadata — accept any extra JSON fields. */
function parseLegacyLoginBody(
  body: unknown,
): { email: string; password: string } | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const email = typeof record.email === 'string' ? record.email.trim() : '';
  const password = typeof record.password === 'string' ? record.password : '';
  if (!email || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return { email, password };
}

function parseLegacyRefreshToken(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const token =
    (typeof record.refreshToken === 'string' && record.refreshToken.trim()) ||
    (typeof record.refresh_token === 'string' && record.refresh_token.trim()) ||
    '';
  return token || null;
}

/** Legacy Laravel app expects a numeric user id, not MongoDB ObjectId strings. */
function legacyAppUserId(mongoId: string): number {
  const hex = mongoId.replace(/[^a-f0-9]/gi, '');
  if (!hex) return 1;
  return parseInt(hex.slice(-7), 16) || 1;
}

type LegacyAppResponse =
  | {
      status: 'success';
      message: string;
      data?: Record<string, unknown>;
    }
  | {
      status: 'error';
      message: string;
    };

type MfsAppSessionTtl = {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
};

/**
 * Drop-in compatibility for the legacy pay.uniqbd.com Android SMS app.
 * Same paths and JSON shapes — only change the app's base URL.
 *
 * Session length is controlled by MFS_APP_* env vars (payments config), not
 * JWT_ACCESS_TTL / JWT_REFRESH_TTL used by the web storefront.
 */
@Controller('app')
export class MfsAppCompatController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly verification: MfsVerificationService,
    private readonly config: ConfigService,
  ) {}

  private mfsAppSessionTtl(): MfsAppSessionTtl {
    return {
      accessTtlSeconds:
        this.config.get<number>('payments.mfsAppAccessTtlSeconds') ??
        LONG_SESSION_TTL_SECONDS,
      refreshTtlSeconds:
        this.config.get<number>('payments.mfsAppRefreshTtlSeconds') ??
        LONG_SESSION_TTL_SECONDS,
    };
  }

  private mfsTokenOpts(): {
    accessTtlOverride: number;
    refreshTtlOverride: number;
  } {
    const ttl = this.mfsAppSessionTtl();
    return {
      accessTtlOverride: ttl.accessTtlSeconds,
      refreshTtlOverride: ttl.refreshTtlSeconds,
    };
  }

  private isStaffUser(roles: Role[]): boolean {
    return isChatStaff(roles);
  }

  private async buildLoginSuccessData(
    result: AuthResult | (AuthTokens & { user: AuthResult['user'] }),
    expiresIn: number,
  ): Promise<Record<string, unknown>> {
    const user = await this.users.findById(result.user.id);
    const token = result.accessToken;
    const now = new Date().toISOString();

    return {
      token,
      access_token: token,
      accessToken: token,
      refreshToken: result.refreshToken,
      refresh_token: result.refreshToken,
      expires_in: expiresIn,
      user: {
        id: legacyAppUserId(result.user.id),
        current_brand_id: 1,
        name:
          [user?.profile?.firstName, user?.profile?.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || 'Admin',
        email: result.user.email,
        phone: user?.phone ?? '01700000000',
        is_super_admin: result.user.roles.some(isAdministratorRole) ? 1 : 0,
        created_at: user?.createdAt?.toISOString?.() ?? now,
        updated_at: user?.updatedAt?.toISOString?.() ?? now,
      },
    };
  }

  @Public()
  @Post('login')
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LegacyAppResponse> {
    const creds = parseLegacyLoginBody(body);
    if (!creds) {
      res.status(HttpStatus.BAD_REQUEST);
      return {
        status: 'error',
        message: 'Please enter email and password',
      };
    }

    const ttl = this.mfsAppSessionTtl();

    try {
      const result = await this.auth.login(
        creds,
        { ip: req.ip, userAgent: req.headers['user-agent'] },
        this.mfsTokenOpts(),
      );
      if (!this.isStaffUser(result.user.roles)) {
        res.status(HttpStatus.UNAUTHORIZED);
        return {
          status: 'error',
          message: 'Invalid email or password',
        };
      }

      res.status(HttpStatus.OK);
      return {
        status: 'success',
        message: 'Login successful',
        data: await this.buildLoginSuccessData(result, ttl.accessTtlSeconds),
      };
    } catch {
      res.status(HttpStatus.UNAUTHORIZED);
      return {
        status: 'error',
        message: 'Invalid email or password',
      };
    }
  }

  /**
   * Optional token rotation for newer Paymently builds.
   * Uses MFS_APP_* TTLs — never JWT_ACCESS_TTL from the web storefront.
   */
  @Public()
  @Post('refresh')
  async refresh(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LegacyAppResponse> {
    const refreshToken = parseLegacyRefreshToken(body);
    if (!refreshToken) {
      res.status(HttpStatus.BAD_REQUEST);
      return {
        status: 'error',
        message: 'Refresh token is required',
      };
    }

    const ttl = this.mfsAppSessionTtl();

    try {
      const tokens = await this.auth.refresh(
        { refreshToken },
        { ip: req.ip, userAgent: req.headers['user-agent'] },
        this.mfsTokenOpts(),
      );
      const publicUser = await this.auth.verifyAccessTokenUser(tokens.accessToken);
      if (!publicUser || !this.isStaffUser(publicUser.roles)) {
        res.status(HttpStatus.UNAUTHORIZED);
        return {
          status: 'error',
          message: 'Invalid refresh token',
        };
      }

      res.status(HttpStatus.OK);
      return {
        status: 'success',
        message: 'Token refreshed',
        data: await this.buildLoginSuccessData(
          { ...tokens, user: publicUser },
          ttl.accessTtlSeconds,
        ),
      };
    } catch {
      res.status(HttpStatus.UNAUTHORIZED);
      return {
        status: 'error',
        message: 'Invalid refresh token',
      };
    }
  }

  /** Revokes the refresh session when the app sends a refresh token. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Body() body: unknown): Promise<LegacyAppResponse> {
    const refreshToken = parseLegacyRefreshToken(body);
    if (refreshToken) {
      await this.auth.logout({ refreshToken });
    }
    return { status: 'success', message: 'Logged out' };
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Post('sms/store')
  async storeSms(@Body() body: unknown) {
    const legacy = await this.verification.syncSmsLegacyApp(body);
    if (legacy.httpStatus === 403) {
      throw new ForbiddenException(legacy.body);
    }
    return legacy.body;
  }
}
