import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditService } from '../shared/audit/audit.service';
import { ActivityService } from './activity.service';
import { QueryActivityDto } from './dto/query-activity.dto';
import { QueryAuditDto } from './dto/query-audit.dto';
import { SecuritySettingsService } from './security-settings.service';

@Controller('security')
export class SecurityController {
  constructor(
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
    private readonly settings: SecuritySettingsService,
  ) {}

  @Public()
  @Get('recaptcha/site-key')
  recaptchaSiteKey() {
    return this.settings.getPublicRecaptcha();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Get('audit-logs')
  auditLogs(@Query() query: QueryAuditDto) {
    return this.audit.list(query, {
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
    });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Get('activity-logs')
  activityLogs(@Query() query: QueryActivityDto) {
    return this.activity.list(query, query.userId);
  }
}
