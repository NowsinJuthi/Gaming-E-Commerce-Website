import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../modules/auth/auth.types';
import { AccessBlockService } from './access-block.service';
import { CreateAccessBlockDto } from './dto/create-access-block.dto';
import { QueryAccessBlocksDto } from './dto/query-access-blocks.dto';
import { UpdateSecuritySettingsDto } from './dto/update-security-settings.dto';
import { SecurityAdminService } from './security-admin.service';
import { RECOMMENDED_REGISTRATION_EMAIL_DOMAINS } from './email-domain-presets';
import { SecuritySettingsService } from './security-settings.service';
import { RequestWithContext } from './security.types';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('security/admin')
export class SecurityAdminController {
  constructor(
    private readonly admin: SecurityAdminService,
    private readonly settings: SecuritySettingsService,
    private readonly blocks: AccessBlockService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('settings')
  getSettings() {
    return this.settings.getSettingsResponse();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateSecuritySettingsDto) {
    return this.settings.updateSettings(dto);
  }

  @Get('recommended-email-domains')
  recommendedEmailDomains() {
    return { domains: [...RECOMMENDED_REGISTRATION_EMAIL_DOMAINS] };
  }

  @Get('blocks')
  listBlocks(@Query() query: QueryAccessBlocksDto) {
    return this.blocks.list(query);
  }

  @Post('blocks')
  createBlock(
    @Body() dto: CreateAccessBlockDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser | undefined;
    const ctx = req as RequestWithContext;
    return this.blocks.block(dto, user, ctx.realIp);
  }

  @Delete('blocks/:id')
  removeBlock(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as AuthenticatedUser | undefined;
    const ctx = req as RequestWithContext;
    return this.blocks.unblock(id, user, ctx.realIp);
  }
}
