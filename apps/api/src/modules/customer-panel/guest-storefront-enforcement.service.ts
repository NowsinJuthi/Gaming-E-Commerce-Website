import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { isGuestSessionAccount } from '../../common/utils/guest-user';
import type { AuthenticatedUser } from '../auth/auth.types';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { CustomerPanelSettingsService } from './customer-panel-settings.service';

@Injectable()
export class GuestStorefrontEnforcementService {
  constructor(
    private readonly panelSettings: CustomerPanelSettingsService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async assertStorefrontBrowseForRequest(
    user?: AuthenticatedUser | null,
  ): Promise<void> {
    if (user && !isGuestSessionAccount(user)) {
      return;
    }
    const config = await this.panelSettings.getConfig();
    if (!config.guestPermissions.guest_browse_storefront) {
      throw new ForbiddenException(
        'Storefront browsing is disabled for guests',
      );
    }
  }

  async assertGuestMediaBrowseForRequest(
    user?: AuthenticatedUser | null,
  ): Promise<void> {
    if (user && !isGuestSessionAccount(user)) {
      return;
    }
    const config = await this.panelSettings.getConfig();
    if (!config.guestPermissions.guest_view_media) {
      throw new ForbiddenException('Guest media browsing is disabled');
    }
  }

  async assertGuestCartAccess(userId: string): Promise<void> {
    const user = await this.userModel
      .findById(userId)
      .select('isGuest email')
      .lean()
      .exec();
    if (!user || !isGuestSessionAccount(user)) {
      return;
    }
    const config = await this.panelSettings.getConfig();
    if (!config.guestPermissions.guest_use_cart) {
      throw new ForbiddenException('Guest cart and checkout are disabled');
    }
  }
}
