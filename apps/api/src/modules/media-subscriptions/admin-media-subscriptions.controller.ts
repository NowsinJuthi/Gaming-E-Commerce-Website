import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import {
  AdminActivateMediaPaymentDto,
  AdminGrantMediaSubscriptionDto,
  AdminPatchMediaSubscriptionDto,
  AdminSuspendMediaSubscriptionDto,
} from './dto/admin-subscription.dto';
import { MediaSubscriptionsService } from './media-subscriptions.service';

@Controller('admin/media/subscriptions')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(Role.Administrator, Role.Admin)
export class AdminMediaSubscriptionsController {
  constructor(private readonly subscriptions: MediaSubscriptionsService) {}

  @Get()
  @Permissions('view_media_subscriptions')
  async list(@Query('userId') userId?: string, @Query('status') status?: string) {
    const rows = await this.subscriptions.listForAdmin(userId, status);
    return {
      subscriptions: await Promise.all(
        rows.map((row) => this.subscriptions.toAdminResponse(row)),
      ),
    };
  }

  @Post()
  @Permissions('manage_media_subscriptions')
  async grant(@Body() dto: AdminGrantMediaSubscriptionDto) {
    const sub = await this.subscriptions.grantComplimentary({
      userId: dto.userId,
      planSlug: dto.planSlug,
      billingCycle: dto.billingCycle,
      status: dto.status,
    });
    return { subscription: await this.subscriptions.toResponse(sub) };
  }

  @Patch(':id')
  @Permissions('manage_media_subscriptions')
  async patch(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: AdminPatchMediaSubscriptionDto,
  ) {
    const sub = await this.subscriptions.adminPatch(String(id), dto);
    return { subscription: await this.subscriptions.toResponse(sub) };
  }

  @Post(':id/activate')
  @Permissions('manage_media_subscriptions')
  async activate(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: AdminActivateMediaPaymentDto,
  ) {
    const sub = await this.subscriptions.activateFromPayment(String(id), {
      provider: dto.provider ?? 'internal',
      externalRef: dto.externalRef ?? `admin-${String(id)}`,
    });
    return { subscription: await this.subscriptions.toResponse(sub) };
  }

  @Post(':id/suspend')
  @Permissions('manage_media_subscriptions')
  async suspend(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: AdminSuspendMediaSubscriptionDto,
  ) {
    const sub = await this.subscriptions.suspend(String(id), dto.reason ?? 'admin_suspend');
    return { subscription: await this.subscriptions.toResponse(sub) };
  }

  @Post(':id/unsuspend')
  @Permissions('manage_media_subscriptions')
  async unsuspend(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    const sub = await this.subscriptions.unsuspend(String(id));
    return { subscription: await this.subscriptions.toResponse(sub) };
  }

  @Delete(':id')
  @Permissions('manage_media_subscriptions')
  async remove(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    const result = await this.subscriptions.adminDelete(String(id));
    return { message: 'Subscription deleted.', ...result };
  }
}
