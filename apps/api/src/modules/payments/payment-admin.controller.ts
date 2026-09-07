import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequiresLicenseFeature } from '../license/decorators/requires-license-feature.decorator';
import { LicenseFeatureGuard } from '../license/guards/license-feature.guard';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { PaymentAdminService } from './payment-admin.service';
import { PaymentSettingsService } from './payment-settings.service';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('payments/admin')
export class PaymentAdminController {
  constructor(
    private readonly admin: PaymentAdminService,
    private readonly settings: PaymentSettingsService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('settings')
  getSettings() {
    return this.settings.getSettingsResponse();
  }

  @Patch('settings')
  @UseGuards(LicenseFeatureGuard)
  @RequiresLicenseFeature('paymentGateway')
  updateSettings(@Body() dto: UpdatePaymentSettingsDto) {
    return this.settings.updateSettings(dto);
  }
}
