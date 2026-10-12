import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../modules/auth/auth.types';
import { isAdministratorRole } from './role.utils';

export function canRefundCustomerOrder(user: AuthenticatedUser): boolean {
  return user.roles.some((role) => isAdministratorRole(role));
}

export function canWriteOrderSecrets(user: AuthenticatedUser): boolean {
  return user.roles.some((role) => isAdministratorRole(role));
}

export function assertCanRefundCustomerOrder(user: AuthenticatedUser): void {
  if (!canRefundCustomerOrder(user)) {
    throw new ForbiddenException('Access denied');
  }
}

export function assertCanWriteOrderSecrets(user: AuthenticatedUser): void {
  if (!canWriteOrderSecrets(user)) {
    throw new ForbiddenException('Access denied');
  }
}
