import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CustomerPanelSettingsService } from './customer-panel-settings.service';

@Controller('customer-panel')
export class CustomerPanelController {
  constructor(private readonly settings: CustomerPanelSettingsService) {}

  @Public()
  @Get('config')
  getConfig() {
    return this.settings.getConfig();
  }
}
