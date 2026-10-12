import { ForbiddenException } from '@nestjs/common';
import { Role } from '../enums';
import {
  assertCanManuallyApproveMfs,
  canManuallyApproveMfs,
  canMutateMfsConfiguration,
} from './mfs-approve-access';

describe('MFS manual approval authorization', () => {
  it('allows administrators', () => {
    expect(canManuallyApproveMfs([Role.Admin], false)).toBe(true);
    expect(canManuallyApproveMfs([Role.Administrator], false)).toBe(true);
  });

  it('denies Support and Editor even if a finance permission is present', () => {
    expect(canManuallyApproveMfs([Role.Support], true)).toBe(false);
    expect(canManuallyApproveMfs([Role.Editor], true)).toBe(false);
    expect(() =>
      assertCanManuallyApproveMfs([Role.Support], true),
    ).toThrow(ForbiddenException);
  });

  it('allows a dedicated finance grant on shop_manager', () => {
    expect(canManuallyApproveMfs([Role.ShopManager], true)).toBe(true);
    expect(canManuallyApproveMfs([Role.ShopManager], false)).toBe(false);
  });
});

describe('MFS configuration mutations', () => {
  it('denies Support write access to MFS gateways and SMS logs', () => {
    expect(canMutateMfsConfiguration([Role.Support])).toBe(false);
    expect(canMutateMfsConfiguration([Role.Editor])).toBe(false);
    expect(canMutateMfsConfiguration([Role.Admin])).toBe(true);
    expect(canMutateMfsConfiguration([Role.ShopManager])).toBe(true);
  });
});
