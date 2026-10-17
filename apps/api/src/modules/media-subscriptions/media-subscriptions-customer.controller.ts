import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  ChangeMediaSubscriptionDto,
  StartMediaSubscriptionDto,
} from './dto/media-customer.dto';
import { MediaSubscriptionsService } from './media-subscriptions.service';

@Controller('media/subscriptions')
export class MediaSubscriptionsCustomerController {
  constructor(private readonly subscriptions: MediaSubscriptionsService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const sub = await this.subscriptions.getCurrentForUser(user.id);
    const entitlement = await this.subscriptions.getEntitlement(user.id);
    return {
      subscription: sub ? await this.subscriptions.toResponse(sub) : null,
      entitlement,
    };
  }

  @Get('me/history')
  async history(@CurrentUser() user: AuthenticatedUser) {
    return { events: await this.subscriptions.history(user.id) };
  }

  @Get('me/changes')
  async changes(@CurrentUser() user: AuthenticatedUser) {
    return { events: await this.subscriptions.planChanges(user.id) };
  }

  @Post()
  async start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartMediaSubscriptionDto) {
    const result = await this.subscriptions.start(user.id, dto.planSlug, dto.billingCycle);
    return {
      subscription: await this.subscriptions.toResponse(result.subscription),
      paymentRequired: result.paymentRequired,
      entitlement: await this.subscriptions.getEntitlement(user.id),
    };
  }

  @Post('me/change')
  @HttpCode(HttpStatus.OK)
  async change(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangeMediaSubscriptionDto) {
    const sub = await this.subscriptions.changePlan(user.id, dto.planSlug, dto.billingCycle);
    return {
      subscription: await this.subscriptions.toResponse(sub),
      entitlement: await this.subscriptions.getEntitlement(user.id),
    };
  }

  @Post('me/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@CurrentUser() user: AuthenticatedUser) {
    const sub = await this.subscriptions.cancel(user.id);
    return {
      subscription: await this.subscriptions.toResponse(sub),
      entitlement: await this.subscriptions.getEntitlement(user.id),
    };
  }

  @Post('me/resume')
  @HttpCode(HttpStatus.OK)
  async resume(@CurrentUser() user: AuthenticatedUser) {
    const sub = await this.subscriptions.resume(user.id);
    return {
      subscription: await this.subscriptions.toResponse(sub),
      entitlement: await this.subscriptions.getEntitlement(user.id),
    };
  }
}
