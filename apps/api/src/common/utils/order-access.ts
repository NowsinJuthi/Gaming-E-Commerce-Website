import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '../enums';
import type { AuthenticatedUser } from '../../modules/auth/auth.types';
import { isAdministratorRole, isChatStaff } from './role.utils';

export function shouldRevealDeliveredCodes(user: AuthenticatedUser): boolean {
  return user.roles.some((role) => isAdministratorRole(role));
}

export function assertCanReadCustomerOrder(
  user: AuthenticatedUser,
  order: { userId: { toString(): string } | string; status: string },
): void {
  const ownerId = String(order.userId);
  const staff = isChatStaff(user.roles);
  if (!staff && ownerId !== user.id) {
    throw new ForbiddenException('Access denied');
  }
  if (!staff && order.status === OrderStatus.Failed) {
    throw new NotFoundException('Order not found');
  }
}

export function assertCanReadPaymentIntent(
  user: AuthenticatedUser,
  intentUserId: string,
): void {
  if (isChatStaff(user.roles)) return;
  if (intentUserId !== user.id) {
    throw new ForbiddenException('Access denied');
  }
}
