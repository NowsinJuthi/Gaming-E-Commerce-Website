import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ContactSettingsService } from './contact-settings.service';

@Controller('contact')
export class ContactPublicController {
  constructor(private readonly settings: ContactSettingsService) {}

  @Public()
  @Get('page-settings')
  getPageSettings() {
    return this.settings.getSettings();
  }
}
