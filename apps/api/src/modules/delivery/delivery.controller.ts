import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequiresLicenseFeature } from '../license/decorators/requires-license-feature.decorator';
import { LicenseFeatureGuard } from '../license/guards/license-feature.guard';
import { DeliveryAdminService } from './delivery-admin.service';
import { DeliverySettingsService } from './delivery-settings.service';
import { UpdateDeliverySettingsDto } from './dto/update-delivery-settings.dto';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('delivery/admin')
export class DeliveryController {
  constructor(
    private readonly admin: DeliveryAdminService,
    private readonly settings: DeliverySettingsService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('settings')
  getSettings() {
    return this.settings.getSettings();
  }

  @Patch('settings')
  @UseGuards(LicenseFeatureGuard)
  @RequiresLicenseFeature('customOrder')
  updateSettings(@Body() dto: UpdateDeliverySettingsDto) {
    return this.settings.updateSettings(dto);
  }

  @Post('retry/:orderId')
  retry(@Param('orderId') orderId: string) {
    return this.admin.retryDelivery(orderId);
  }
}
