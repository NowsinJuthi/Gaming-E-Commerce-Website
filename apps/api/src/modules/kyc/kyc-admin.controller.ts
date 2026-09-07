import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { QueryKycRequestsDto } from './dto/query-kyc-requests.dto';
import { RejectKycDto } from './dto/reject-kyc.dto';
import { KycService } from './kyc.service';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('kyc/admin')
export class KycAdminController {
  constructor(private readonly kyc: KycService) {}

  @Get('overview')
  overview() {
    return this.kyc.adminOverview();
  }

  @Get('requests')
  list(@Query() query: QueryKycRequestsDto) {
    return this.kyc.adminListRequests(query);
  }

  @Post('requests/:id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.kyc.adminApproveRequest(id, admin.id);
  }

  @Post('requests/:id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: RejectKycDto,
  ) {
    return this.kyc.adminRejectRequest(id, admin.id, dto.rejectionReason);
  }
}
