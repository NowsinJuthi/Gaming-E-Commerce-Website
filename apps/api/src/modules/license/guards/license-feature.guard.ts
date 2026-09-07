import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  LICENSE_FEATURE_KEY,
  LICENSE_FEATURE_LABELS,
  type LicenseFeatureKey,
} from '../license.constants';
import { LicenseService } from '../license.service';

@Injectable()
export class LicenseFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly license: LicenseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<
      LicenseFeatureKey | undefined
    >(LICENSE_FEATURE_KEY, [context.getHandler(), context.getClass()]);
    if (!feature) {
      return true;
    }

    const enabled = await this.license.hasFeature(feature);
    if (!enabled) {
      const label = LICENSE_FEATURE_LABELS[feature] ?? feature;
      throw new ForbiddenException(
        `License feature "${label}" is not enabled for this installation.`,
      );
    }
    return true;
  }
}
