import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AffiliateService } from './affiliate.service';
import { AttachReferralDto } from './dto/attach-referral.dto';
import { QueryAffiliatesDto } from './dto/query-affiliates.dto';
import { QueryCommissionsDto } from './dto/query-commissions.dto';
import { RejectCommissionDto } from './dto/reject-commission.dto';
import { TrackClickDto } from './dto/track-click.dto';
import { UpdateAffiliateDto } from './dto/update-affiliate.dto';

const headerValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly affiliate: AffiliateService) {}

  // --- Public tracking ---

  @Public()
  @Post('track')
  track(@Body() dto: TrackClickDto, @Req() req: Request) {
    return this.affiliate.recordClick(dto.code, {
      ip: req.ip,
      userAgent: headerValue(req.headers['user-agent']),
      landingPath: dto.landingPath,
    });
  }

  // --- Affiliate self-service ---

  @Get('me')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.affiliate.getDashboard(user);
  }

  @Post('refer')
  refer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AttachReferralDto,
  ) {
    return this.affiliate.attachReferral(user, dto.code);
  }

  @Get('commissions')
  myCommissions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryCommissionsDto,
  ) {
    return this.affiliate.listMyCommissions(user, query);
  }

  // --- Admin: payouts + reports ---

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Get('admin/overview')
  overview() {
    return this.affiliate.adminOverview();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Get('admin/affiliates')
  listAffiliates(@Query() query: QueryAffiliatesDto) {
    return this.affiliate.adminListAffiliates(query);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Patch('admin/affiliates/:id')
  updateAffiliate(
    @Param('id') id: string,
    @Body() dto: UpdateAffiliateDto,
  ) {
    return this.affiliate.adminUpdateAffiliate(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Get('admin/commissions')
  allCommissions(@Query() query: QueryCommissionsDto) {
    return this.affiliate.adminListCommissions(query);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Get('admin/payouts/report')
  report() {
    return this.affiliate.payoutReport();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Post('admin/commissions/:id/approve')
  approve(@Param('id') id: string) {
    return this.affiliate.approveCommission(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Post('admin/commissions/:id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectCommissionDto) {
    return this.affiliate.rejectCommission(id, dto.note);
  }
}
