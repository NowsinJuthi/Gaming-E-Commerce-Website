import { ForbiddenException } from '@nestjs/common';
import { Role } from '../enums';
import { isAdministratorRole } from './role.utils';

/**
 * Support/Editor must never settle MFS money by clicking Approve.
 * Administrators always may. A dedicated finance grant (shop_manager +
 * `approve_mfs_payments`) may also approve.
 */
export function canManuallyApproveMfs(
  roles: string[],
  hasFinancePermission: boolean,
): boolean {
  if (roles.some((role) => isAdministratorRole(role))) {
    return true;
  }
  if (roles.includes(Role.Support) || roles.includes(Role.Editor)) {
    return false;
  }
  return hasFinancePermission;
}

export function assertCanManuallyApproveMfs(
  roles: string[],
  hasFinancePermission: boolean,
): void {
  if (!canManuallyApproveMfs(roles, hasFinancePermission)) {
    throw new ForbiddenException(
      'Only an administrator or a finance-permissioned role may approve MFS payments',
    );
  }
}

/** Support may read MFS admin data; gateway/SMS mutations stay Admin/ShopManager. */
export function canMutateMfsConfiguration(roles: string[]): boolean {
  if (roles.some((role) => isAdministratorRole(role))) {
    return true;
  }
  return roles.includes(Role.ShopManager);
}
