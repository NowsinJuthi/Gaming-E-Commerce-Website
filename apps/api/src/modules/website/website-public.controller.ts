import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { WebsiteSettingsService } from './website-settings.service';

@Controller('website')
export class WebsitePublicController {
  constructor(private readonly settings: WebsiteSettingsService) {}

  @Public()
  @Get('page-settings')
  getPageSettings() {
    return this.settings.getSettings();
  }
}
