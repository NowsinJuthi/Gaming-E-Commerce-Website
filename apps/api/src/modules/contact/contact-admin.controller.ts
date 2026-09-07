import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ContactSettingsService } from './contact-settings.service';
import { UpdateContactSettingsDto } from './dto/update-contact-settings.dto';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('contact/admin')
export class ContactAdminController {
  constructor(private readonly settings: ContactSettingsService) {}

  @Get('settings')
  getSettings() {
    return this.settings.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateContactSettingsDto) {
    return this.settings.updateSettings(dto);
  }
}
