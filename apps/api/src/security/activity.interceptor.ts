import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { AuthenticatedUser } from '../modules/auth/auth.types';
import { ActivityService } from './activity.service';
import { SecuritySettingsService } from './security-settings.service';
import { RequestWithContext, resolveClientIp } from './security.types';

/**
 * Records mutating requests to the activity trail. Reads (GET/HEAD/OPTIONS) are
 * skipped to keep write volume sane at high traffic; the write is
 * fire-and-forget so it never adds latency to the response.
 */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  private readonly tracked = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  constructor(
    private readonly activity: ActivityService,
    private readonly securitySettings: SecuritySettingsService,
    private readonly config: ConfigService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const req = context.switchToHttp().getRequest<RequestWithContext>();
    if (!this.tracked.has(req.method)) {
      return next.handle();
    }

    const start = Date.now();
    const write = (): void => {
      void this.maybeRecord(req, context, start);
    };

    return next.handle().pipe(tap({ next: write, error: write }));
  }

  private async maybeRecord(
    req: RequestWithContext,
    context: ExecutionContext,
    start: number,
  ): Promise<void> {
    const envEnabled =
      this.config.get<boolean>('security.activity.enabled') ?? true;
    const effective = await this.securitySettings.getEffective();
    if (!envEnabled || !effective.activity.enabled) {
      return;
    }
    if (
      effective.activity.sampleRate < 1 &&
      Math.random() > effective.activity.sampleRate
    ) {
      return;
    }

    const res = context.switchToHttp().getResponse<Response>();
    const user = req.user as AuthenticatedUser | undefined;
    this.activity.record({
      userId: user?.id,
      method: req.method,
      path: (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '',
      statusCode: res?.statusCode,
      durationMs: Date.now() - start,
      ip: resolveClientIp(req),
      userAgent: req.headers['user-agent'],
      country: req.cfCountry,
      cfRay: req.cfRay,
    });
  }
}
