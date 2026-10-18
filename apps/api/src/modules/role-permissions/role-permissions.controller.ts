import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RolePermissionsService } from './role-permissions.service';

@Controller('role-permissions')
export class RolePermissionsController {
  constructor(private readonly service: RolePermissionsService) {}

  /** Public guest capability flags (Roles → Guest profile). */
  @Public()
  @Get('guest')
  guestPolicy() {
    return this.service.getGuestStorefrontPermissions();
  }

  /** Effective permissions for the signed-in user (merged across role profiles). */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getEffectivePermissionsForUser(user.roles);
  }
}
