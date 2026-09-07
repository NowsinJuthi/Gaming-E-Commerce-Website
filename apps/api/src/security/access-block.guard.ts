import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '../common/enums';
import type { AuthenticatedUser } from '../modules/auth/auth.types';
import { AccessBlockService } from './access-block.service';
import { RequestWithContext } from './security.types';

/**
 * Denies requests from blocked IPs or countries. Admin users and security
 * admin routes bypass so staff can manage blocks from anywhere.
 */
@Injectable()
export class AccessBlockGuard implements CanActivate {
  constructor(private readonly blocks: AccessBlockService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';

    if (path.includes('/health') || path.includes('/security/admin')) {
      return true;
    }

    const user = req.user as AuthenticatedUser | undefined;
    if (user?.roles?.includes(Role.Admin)) {
      return true;
    }

    const result = await this.blocks.check(req.realIp, req.cfCountry);
    if (!result.blocked) {
      return true;
    }

    if (result.type === 'ip') {
      throw new ForbiddenException('Access from your IP address is blocked.');
    }
    throw new ForbiddenException('Access from your country is blocked.');
  }
}
