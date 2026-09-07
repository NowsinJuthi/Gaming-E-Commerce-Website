import { SetMetadata } from '@nestjs/common';
import {
  LICENSE_FEATURE_KEY,
  type LicenseFeatureKey,
} from '../license.constants';

export const RequiresLicenseFeature = (
  feature: LicenseFeatureKey,
): MethodDecorator & ClassDecorator =>
  SetMetadata(LICENSE_FEATURE_KEY, feature);
