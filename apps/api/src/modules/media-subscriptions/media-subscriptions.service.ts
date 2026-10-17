import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BillingCycle,
  SubscriptionEventType,
  SubscriptionStatus,
} from './media-subscription.types';
import { MediaPlansService } from './media-plans.service';
import { addBillingCycle, addDays, priceForCycle } from './period';
import {
  fallbackPlan,
  snapshotPlan,
  toPublicPlan,
  toPublicSubscription,
} from './subscription.mapper';
import {
  MediaSubscription,
  MediaSubscriptionDocument,
} from './schemas/media-subscription.schema';
import {
  MediaSubscriptionEvent,
  MediaSubscriptionEventDocument,
} from './schemas/media-subscription-event.schema';
import { UsersService } from '../users/users.service';
import type { UserDocument } from '../../database/schemas/user.schema';

export type PaymentActivationInput = {
  provider: string;
  externalRef: string;
  paidCents?: number;
};

@Injectable()
export class MediaSubscriptionsService {
  constructor(
    @InjectModel(MediaSubscription.name)
    private readonly subModel: Model<MediaSubscriptionDocument>,
    @InjectModel(MediaSubscriptionEvent.name)
    private readonly eventModel: Model<MediaSubscriptionEventDocument>,
    private readonly plans: MediaPlansService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  graceDays(): number {
    return this.config.get<number>('MEDIA_SUBSCRIPTION_GRACE_DAYS') ?? 3;
  }

  findCurrent(userId: string) {
    return this.subModel.findOne({ userId, isCurrent: true }).exec();
  }

  findById(id: string) {
    return this.subModel.findById(id).exec();
  }

  async toResponse(sub: MediaSubscriptionDocument) {
    const planDoc = await this.plans.findById(String(sub.planId));
    const plan = planDoc ? toPublicPlan(planDoc) : fallbackPlan(sub);
    return toPublicSubscription(sub, plan);
  }

  userDisplayName(user: UserDocument | null): string {
    if (!user) return '';
    const profile = user.profile;
    if (profile?.displayName?.trim()) return profile.displayName.trim();
    const parts = [profile?.firstName, profile?.lastName].filter(Boolean);
    if (parts.length) return parts.join(' ');
    return user.email;
  }

  async toAdminResponse(sub: MediaSubscriptionDocument) {
    const base = await this.toResponse(sub);
    const userId = String(sub.userId);
    const user = await this.users.findById(userId);
    return {
      ...base,
      userEmail: user?.email ?? '',
      userDisplayName: this.userDisplayName(user),
      deviceCount: 0,
      streamCount: 0,
      maxDevices: sub.maxDevices,
      maxStreams: sub.maxStreams,
    };
  }

  async listForAdmin(userId?: string, status?: string) {
    const filter: Record<string, unknown> = {};
    if (userId) filter.userId = userId;
    if (status) filter.status = status;
    return this.subModel.find(filter).sort({ createdAt: -1 }).limit(200).exec();
  }

  async activateFromPayment(
    subscriptionId: string,
    input: PaymentActivationInput,
  ): Promise<MediaSubscriptionDocument> {
    const sub = await this.requireById(subscriptionId);
    if (
      sub.status === SubscriptionStatus.Active &&
      sub.externalPaymentRef &&
      sub.externalPaymentRef === input.externalRef
    ) {
      return sub;
    }
    const from = sub.status;
    const now = new Date();
    sub.paymentProvider = input.provider;
    sub.externalPaymentRef = input.externalRef;
    sub.autoRenew = true;
    sub.cancelAtPeriodEnd = false;
    sub.cancelledAt = null;
    sub.endedAt = null;
    sub.suspendedAt = null;
    sub.suspensionReason = null;
    sub.gracePeriodEndsAt = null;
    sub.status = SubscriptionStatus.Active;
    sub.lastRenewedAt = now;
    sub.isCurrent = true;

    if (from === SubscriptionStatus.Active) {
      const start = sub.currentPeriodEnd.getTime() > now.getTime() ? sub.currentPeriodEnd : now;
      sub.currentPeriodStart = start;
      sub.currentPeriodEnd = addBillingCycle(start, sub.billingCycle);
    } else if (
      from === SubscriptionStatus.Trial ||
      from === SubscriptionStatus.Pending ||
      from === SubscriptionStatus.Suspended ||
      from === SubscriptionStatus.Expired
    ) {
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = addBillingCycle(now, sub.billingCycle);
    }

    await sub.save();
    await this.recordEvent(sub, SubscriptionEventType.Activated, {
      fromStatus: from,
      toStatus: sub.status,
      billingCycle: sub.billingCycle,
      note: 'Activated from payment.',
      metadata: { paidCents: input.paidCents, externalRef: input.externalRef },
    });
    return sub;
  }

  async suspend(subscriptionId: string, reason = 'admin_suspend'): Promise<MediaSubscriptionDocument> {
    return this.recordFailedRenewal(subscriptionId, reason);
  }

  async adminDelete(id: string): Promise<{ id: string; userId: string }> {
    const sub = await this.requireById(id);
    const userId = String(sub.userId);
    const subscriptionId = String(sub._id);
    await this.recordEvent(sub, SubscriptionEventType.Cancelled, {
      fromStatus: sub.status,
      toStatus: SubscriptionStatus.Expired,
      note: 'Admin deleted subscription.',
    });
    await this.subModel.deleteOne({ _id: sub._id });
    return { id: subscriptionId, userId };
  }

  async unsuspend(subscriptionId: string): Promise<MediaSubscriptionDocument> {
    const sub = await this.requireById(subscriptionId);
    if (sub.status !== SubscriptionStatus.Suspended) {
      throw new BadRequestException('Subscription is not suspended.');
    }
    const from = sub.status;
    sub.status = SubscriptionStatus.Active;
    sub.suspendedAt = null;
    sub.suspensionReason = null;
    sub.gracePeriodEndsAt = null;
    if (new Date() > sub.currentPeriodEnd) {
      sub.currentPeriodStart = new Date();
      sub.currentPeriodEnd = addBillingCycle(new Date(), sub.billingCycle);
    }
    await sub.save();
    await this.recordEvent(sub, SubscriptionEventType.Unsuspended, {
      fromStatus: from,
      toStatus: sub.status,
      note: 'Access restored.',
    });
    return sub;
  }

  async grantComplimentary(input: {
    userId: string;
    planSlug: string;
    billingCycle: BillingCycle;
    status?: SubscriptionStatus;
  }): Promise<MediaSubscriptionDocument> {
    const account = await this.users.findById(input.userId);
    if (!account) {
      throw new NotFoundException('User not found.');
    }
    const current = await this.findCurrent(input.userId);
    if (current) {
      current.isCurrent = false;
      await current.save();
    }
    const plan = await this.plans.getActiveBySlug(input.planSlug);
    const now = new Date();
    const status = input.status ?? SubscriptionStatus.Active;
    const periodEnd =
      status === SubscriptionStatus.Trial
        ? addDays(now, Math.max(plan.trialDays, 1))
        : addBillingCycle(now, input.billingCycle);
    const snapshot = snapshotPlan(plan);
    const created = await this.subModel.create({
      userId: new Types.ObjectId(input.userId),
      ...snapshot,
      billingCycle: input.billingCycle,
      status,
      priceCents: priceForCycle(plan.monthlyPriceCents, plan.yearlyPriceCents, input.billingCycle),
      autoRenew: status !== SubscriptionStatus.Pending,
      cancelAtPeriodEnd: false,
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialStart: status === SubscriptionStatus.Trial ? now : null,
      trialEnd: status === SubscriptionStatus.Trial ? periodEnd : null,
      paymentProvider: 'complimentary',
      isCurrent: true,
    });
    await this.recordEvent(created, SubscriptionEventType.Created, {
      toPlanSlug: plan.slug,
      toStatus: status,
      billingCycle: input.billingCycle,
      note: 'Admin grant.',
    });
    return created;
  }

  async adminPatch(
    id: string,
    patch: {
      status?: SubscriptionStatus;
      currentPeriodEnd?: string;
      trialEnd?: string;
      gracePeriodEndsAt?: string;
      scheduledChangeAt?: string;
      reason?: string;
      autoRenew?: boolean;
    },
  ): Promise<MediaSubscriptionDocument> {
    const sub = await this.requireById(id);
    const from = sub.status;
    if (patch.currentPeriodEnd) {
      sub.currentPeriodEnd = new Date(patch.currentPeriodEnd);
    }
    if (patch.trialEnd) {
      sub.trialEnd = new Date(patch.trialEnd);
    }
    if (patch.gracePeriodEndsAt) {
      sub.gracePeriodEndsAt = new Date(patch.gracePeriodEndsAt);
    }
    if (patch.scheduledChangeAt) {
      sub.scheduledChangeAt = new Date(patch.scheduledChangeAt);
    }
    if (patch.autoRenew !== undefined) {
      sub.autoRenew = patch.autoRenew;
    }
    if (patch.status && patch.status !== sub.status) {
      sub.status = patch.status;
      if (patch.status === SubscriptionStatus.Cancelled) {
        sub.cancelAtPeriodEnd = true;
        sub.autoRenew = false;
        sub.cancelledAt = new Date();
      }
      if (patch.status === SubscriptionStatus.Expired) {
        sub.endedAt = new Date();
        sub.autoRenew = false;
      }
      if (patch.status === SubscriptionStatus.Suspended) {
        sub.suspendedAt = new Date();
        sub.suspensionReason = patch.reason ?? 'admin';
        sub.gracePeriodEndsAt = sub.gracePeriodEndsAt ?? addDays(new Date(), this.graceDays());
      }
      if (patch.status === SubscriptionStatus.Active) {
        sub.endedAt = null;
        sub.cancelledAt = null;
        sub.suspendedAt = null;
        sub.gracePeriodEndsAt = null;
      }
    }
    await sub.save();
    if (patch.status && patch.status !== from) {
      await this.recordEvent(sub, SubscriptionEventType.PlanChanged, {
        fromStatus: from,
        toStatus: sub.status,
        note: patch.reason ?? 'Admin status update.',
      });
    }
    return sub;
  }

  private async recordFailedRenewal(
    subscriptionId: string,
    reason = 'renewal_failed',
  ): Promise<MediaSubscriptionDocument> {
    const sub = await this.requireById(subscriptionId);
    const from = sub.status;
    const now = new Date();
    sub.status = SubscriptionStatus.Suspended;
    sub.suspendedAt = now;
    sub.suspensionReason = reason;
    sub.gracePeriodEndsAt = addDays(now, this.graceDays());
    await sub.save();
    await this.recordEvent(sub, SubscriptionEventType.Suspended, {
      fromStatus: from,
      toStatus: sub.status,
      note: reason,
    });
    await this.recordEvent(sub, SubscriptionEventType.GraceStarted, {
      toStatus: sub.status,
      note: `Grace until ${sub.gracePeriodEndsAt.toISOString()}`,
    });
    return sub;
  }

  private async requireById(id: string): Promise<MediaSubscriptionDocument> {
    const sub = await this.findById(id);
    if (!sub) {
      throw new NotFoundException('Subscription not found.');
    }
    return sub;
  }

  private async recordEvent(
    sub: MediaSubscriptionDocument,
    type: SubscriptionEventType,
    extra: Partial<{
      fromPlanSlug: string | null;
      toPlanSlug: string | null;
      fromStatus: SubscriptionStatus | null;
      toStatus: SubscriptionStatus | null;
      billingCycle: BillingCycle | null;
      note: string | null;
      metadata: Record<string, unknown>;
    }>,
  ) {
    await this.eventModel.create({
      subscriptionId: sub._id,
      userId: sub.userId,
      type,
      fromPlanSlug: extra.fromPlanSlug ?? null,
      toPlanSlug: extra.toPlanSlug ?? sub.planSlug,
      fromStatus: extra.fromStatus ?? null,
      toStatus: extra.toStatus ?? sub.status,
      billingCycle: extra.billingCycle ?? sub.billingCycle,
      note: extra.note ?? null,
      metadata: extra.metadata ?? {},
    });
  }
}
