import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
const THROTTLER_SKIP_DEFAULT = 'THROTTLER:SKIPdefault';
import { SecuritySettingsService } from '../security-settings.service';
import { resolveClientIp, RequestWithContext } from '../security.types';

interface RouteLimits {
  limit: number;
  ttl: number;
  blockDuration: number;
}

/**
 * Throttler guard keyed on the real visitor IP (Cloudflare-aware). Limits are
 * read from admin security settings so they can be tuned without redeploying.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly securitySettings: SecuritySettingsService,
  ) {
    super(options, storageService, reflector);
  }

  override canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return Promise.resolve(true);
    }
    return this.applyDynamicLimits(context);
  }

  protected override getTracker(req: RequestWithContext): Promise<string> {
    return Promise.resolve(resolveClientIp(req) ?? 'unknown');
  }

  private async applyDynamicLimits(
    context: ExecutionContext,
  ): Promise<boolean> {
    const settings = await this.securitySettings.getEffective();
    if (!settings.throttle.enabled) {
      return true;
    }

    const handler = context.getHandler();
    const classRef = context.getClass();
    const skip = this.reflector.getAllAndOverride<boolean>(
      THROTTLER_SKIP_DEFAULT,
      [handler, classRef],
    );
    if (skip) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
    const { limit, ttl, blockDuration } = this.resolveLimits(path, settings);

    const namedThrottler = this.throttlers[0];
    if (!namedThrottler) {
      return true;
    }

    const getTracker =
      namedThrottler.getTracker ??
      this.commonOptions.getTracker ??
      ((req: Record<string, unknown>) =>
        this.getTracker(req as unknown as RequestWithContext));

    return this.handleRequest({
      context,
      limit,
      ttl,
      throttler: namedThrottler,
      blockDuration,
      getTracker,
      generateKey:
        namedThrottler.generateKey ??
        this.commonOptions.generateKey ??
        this.generateKey.bind(this),
    });
  }

  private resolveLimits(
    path: string,
    settings: Awaited<ReturnType<SecuritySettingsService['getEffective']>>,
  ): RouteLimits {
    const authTtl = settings.throttle.authTtlMs;
    const block = settings.throttle.blockMs;

    if (path.endsWith('/auth/register')) {
      return {
        limit: settings.throttle.registerLimit,
        ttl: authTtl,
        blockDuration: block,
      };
    }
    if (path.endsWith('/auth/login')) {
      return {
        limit: settings.throttle.loginLimit,
        ttl: authTtl,
        blockDuration: block,
      };
    }
    if (
      path.endsWith('/auth/otp/request') ||
      path.endsWith('/auth/resend-verification')
    ) {
      return {
        limit: settings.throttle.otpLimit,
        ttl: authTtl,
        blockDuration: block,
      };
    }
    if (path.endsWith('/auth/otp/verify')) {
      return {
        limit: settings.throttle.loginLimit,
        ttl: authTtl,
        blockDuration: block,
      };
    }

    return {
      limit: settings.throttle.limit,
      ttl: settings.throttle.ttlMs,
      blockDuration: block,
    };
  }
}
