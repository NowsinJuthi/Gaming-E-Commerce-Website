import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../../modules/role-permissions/role-permissions.constants';

export const PERMISSIONS_KEY = 'permissions';

/** Requires every listed permission (AND). Enforced by PermissionsGuard. */
export const Permissions = (
  ...permissions: PermissionKey[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
