import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RolePermissionsService } from '../role-permissions/role-permissions.service';

@Injectable()
export class MediaPlaybackAccessService {
  constructor(private readonly rolePermissions: RolePermissionsService) {}

  async assertPlayAllowed(user?: AuthenticatedUser | null): Promise<void> {
    const allowed = await this.rolePermissions.resolveMediaPlayAllowed(user);
    if (!allowed) {
      throw new ForbiddenException('Media playback is not allowed for this account');
    }
  }
}
