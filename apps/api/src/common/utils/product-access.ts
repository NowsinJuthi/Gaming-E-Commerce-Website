import { NotFoundException } from '@nestjs/common';
import { Role } from '../enums';
import { userHasRole } from './role.utils';
import type { AuthenticatedUser } from '../../modules/auth/auth.types';

export function isProductAdministrator(user: AuthenticatedUser): boolean {
  return userHasRole(user.roles, Role.Admin);
}

export function isProductSupport(user: AuthenticatedUser): boolean {
  return userHasRole(user.roles, Role.Support);
}

export function isProductSupplier(user: AuthenticatedUser): boolean {
  return userHasRole(user.roles, Role.Supplier);
}

export function supplierOwnsProduct(
  user: AuthenticatedUser,
  ownerUserId: unknown,
): boolean {
  return Boolean(ownerUserId) && String(ownerUserId) === user.id;
}

/** Admin and Support see the full catalog; suppliers see only products they created. */
export function assertCanReadProductAdmin(
  user: AuthenticatedUser,
  ownerUserId: unknown,
): void {
  if (isProductAdministrator(user) || isProductSupport(user)) return;
  if (isProductSupplier(user) && supplierOwnsProduct(user, ownerUserId)) return;
  throw new NotFoundException('Product not found');
}

/** Only Admin or the owning supplier may mutate a product or its inventory. */
export function assertCanMutateProduct(
  user: AuthenticatedUser,
  ownerUserId: unknown,
): void {
  if (isProductAdministrator(user)) return;
  if (isProductSupplier(user) && supplierOwnsProduct(user, ownerUserId)) return;
  throw new NotFoundException('Product not found');
}

/** Support can list inventory metadata but must not receive plaintext codes. */
export function shouldRedactInventoryValues(user: AuthenticatedUser): boolean {
  return isProductSupport(user) && !isProductAdministrator(user);
}

export function maskInventoryValue(): string {
  return '••••';
}
