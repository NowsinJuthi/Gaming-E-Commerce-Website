import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LiveAnalyticsService } from './live-analytics.service';

@Controller()
@UseGuards(RolesGuard)
@Roles(
  Role.Administrator,
  Role.Admin,
  Role.ShopManager,
  Role.Editor,
  Role.Support,
)
export class LiveAnalyticsController {
  constructor(private readonly live: LiveAnalyticsService) {}

  @Get('admin/live-analytics/snapshot')
  snapshot() {
    return this.live.getSnapshot();
  }
}
