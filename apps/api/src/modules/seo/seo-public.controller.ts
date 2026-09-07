import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { SeoSettingsService } from './seo-settings.service';

/** Public, cached SEO configuration consumed by the storefront. */
@Controller('seo')
export class SeoPublicController {
  constructor(private readonly settings: SeoSettingsService) {}

  @Public()
  @Get('config')
  config() {
    return this.settings.getPublicConfig();
  }

  @Public()
  @Get('robots')
  async robots() {
    return { content: await this.settings.getRobotsContent() };
  }
}
