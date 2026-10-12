import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuditActorType } from '../database/schemas/audit-log.schema';
import { AuditService } from '../shared/audit/audit.service';
import { RecaptchaService } from './recaptcha.service';
import { RequestWithContext, resolveClientIp } from './security.types';

const headerValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

/**
 * Verifies a reCAPTCHA token (header `x-recaptcha-token`) on sensitive public
 * endpoints. No-op when reCAPTCHA is not configured. Failures are audited.
 */
@Injectable()
export class RecaptchaGuard implements CanActivate {
  constructor(
    private readonly recaptcha: RecaptchaService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const token =
      headerValue(req.headers['x-recaptcha-token']) ??
      headerValue(req.headers['x-captcha-token']);
    const ip = resolveClientIp(req);

    const enabled = await this.recaptcha.isEnabled();
    if (!enabled) {
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenException('reCAPTCHA is not configured');
      }
      return true;
    }

    const result = await this.recaptcha.verify(token, ip);
    if (!result.success) {
      await this.audit.record({
        action: 'recaptcha.failed',
        actorType: AuditActorType.System,
        status: 'blocked',
        ip,
        metadata: {
          reason: result.reason,
          score: result.score,
          path: (req.originalUrl ?? req.url).split('?')[0],
        },
      });
      throw new ForbiddenException('reCAPTCHA verification failed');
    }
    return true;
  }
}
