import { Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminDashboardService } from './admin-dashboard.service';
import { DateRangeDto } from './dto/date-range.dto';
import { SystemStatusService } from './system-status.service';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('admin/dashboard')
export class AdminController {
  constructor(
    private readonly dashboard: AdminDashboardService,
    private readonly systemStatus: SystemStatusService,
  ) {}

  @Get('overview')
  overview() {
    return this.dashboard.overview();
  }

  @Get('revenue')
  revenue() {
    return this.dashboard.revenue();
  }

  @Get('orders')
  orders() {
    return this.dashboard.orders();
  }

  @Get('users')
  users() {
    return this.dashboard.users();
  }

  @Get('suppliers')
  suppliers() {
    return this.dashboard.suppliers();
  }

  @Get('reports')
  reports(@Query() query: DateRangeDto) {
    return this.dashboard.reports(query);
  }

  @Get('status')
  status() {
    return this.systemStatus.status();
  }

  /** Flush public caches, persist timestamp, and broadcast site.published event. */
  @Post('publish')
  @HttpCode(HttpStatus.OK)
  publish() {
    return this.dashboard.publish();
  }

  /** Return the ISO timestamp of the last manual publish, or null. */
  @Get('last-publish')
  lastPublish() {
    return this.dashboard.getLastPublish();
  }
}
