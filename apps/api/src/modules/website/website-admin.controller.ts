import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateWebsiteSettingsDto } from './dto/update-website-settings.dto';
import { WebsiteSettingsService } from './website-settings.service';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('website/admin')
export class WebsiteAdminController {
  constructor(private readonly settings: WebsiteSettingsService) {}

  @Get('settings')
  getSettings() {
    return this.settings.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateWebsiteSettingsDto) {
    return this.settings.updateSettings(dto);
  }
}
