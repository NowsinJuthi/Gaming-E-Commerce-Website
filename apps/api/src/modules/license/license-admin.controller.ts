import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateLicenseSettingsDto } from './dto/update-license-settings.dto';
import { ApplyLicenseKeyDto } from './dto/apply-license-key.dto';
import { LicenseService } from './license.service';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('license/admin')
export class LicenseAdminController {
  constructor(private readonly license: LicenseService) {}

  @Get('status')
  status() {
    return this.license.getAdminStatus();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateLicenseSettingsDto) {
    return this.license.updateSettings(dto);
  }

  @Post('activate')
  activate() {
    return this.license.activate();
  }

  @Post('apply')
  apply(@Body() dto: ApplyLicenseKeyDto) {
    return this.license.activateWithKey(dto.licenseKey);
  }

  @Post('activate-key')
  activateKey(@Body() dto: ApplyLicenseKeyDto) {
    return this.license.activateWithKey(dto.licenseKey);
  }

  @Post('validate')
  async validate() {
    await this.license.validate(true);
    return this.license.getAdminStatus();
  }
}
