import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { PermissionKey } from '../../modules/role-permissions/role-permissions.constants';
import { RolePermissionsService } from '../../modules/role-permissions/role-permissions.service';
import type { AuthenticatedUser } from '../../modules/auth/auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolePermissions: RolePermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user?.roles?.length) {
      throw new ForbiddenException('Insufficient permissions');
    }

    for (const permission of required) {
      const allowed = await this.rolePermissions.rolesHavePermission(
        user.roles,
        permission,
      );
      if (!allowed) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }
    return true;
  }
}
