import { NotFoundException } from '@nestjs/common';
import { Role } from '../enums';
import type { AuthenticatedUser } from '../../modules/auth/auth.types';
import {
  assertCanMutateProduct,
  assertCanReadProductAdmin,
  shouldRedactInventoryValues,
} from './product-access';

function user(id: string, roles: Role[]): AuthenticatedUser {
  return { id, email: `${id}@example.test`, roles };
}

describe('product-access', () => {
  const ownerId = 'aaaaaaaaaaaaaaaaaaaaaaaa';

  it('lets admin mutate any product', () => {
    expect(() =>
      assertCanMutateProduct(user('admin', [Role.Admin]), undefined),
    ).not.toThrow();
  });

  it('lets a supplier mutate only their own product', () => {
    const supplier = user(ownerId, [Role.Supplier]);
    expect(() => assertCanMutateProduct(supplier, ownerId)).not.toThrow();
    expect(() => assertCanMutateProduct(supplier, undefined)).toThrow(
      NotFoundException,
    );
    expect(() =>
      assertCanMutateProduct(supplier, 'bbbbbbbbbbbbbbbbbbbbbbbb'),
    ).toThrow(NotFoundException);
  });

  it('lets support read but redacts inventory values', () => {
    const support = user('support', [Role.Support]);
    expect(() => assertCanReadProductAdmin(support, undefined)).not.toThrow();
    expect(() => assertCanMutateProduct(support, undefined)).toThrow(
      NotFoundException,
    );
    expect(shouldRedactInventoryValues(support)).toBe(true);
    expect(shouldRedactInventoryValues(user('admin', [Role.Admin]))).toBe(
      false,
    );
  });
});
