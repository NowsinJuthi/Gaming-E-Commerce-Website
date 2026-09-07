import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RolePermissionsService } from './role-permissions.service';

@Controller('role-permissions')
export class RolePermissionsController {
  constructor(private readonly service: RolePermissionsService) {}

  /** Effective permissions for the signed-in user (merged across role profiles). */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getEffectivePermissionsForUser(user.roles);
  }
}
