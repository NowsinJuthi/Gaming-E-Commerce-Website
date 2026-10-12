import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { hasCloudflareRay } from './cloudflare-edge';
import { SecuritySettingsService } from './security-settings.service';
import { RequestWithContext } from './security.types';

/**
 * Optionally blocks direct-to-origin traffic when Cloudflare headers are
 * required. Health probes are always allowed.
 */
@Injectable()
export class CloudflareGuard implements CanActivate {
  constructor(private readonly settings: SecuritySettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const effective = await this.settings.getEffective();
    if (!effective.cloudflare.enabled || !effective.cloudflare.requireHeaders) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
    if (path.includes('/health')) {
      return true;
    }

    if (!hasCloudflareRay(req.headers)) {
      throw new ForbiddenException(
        'Direct access is not allowed. Use the Cloudflare-protected domain.',
      );
    }
    return true;
  }
}
