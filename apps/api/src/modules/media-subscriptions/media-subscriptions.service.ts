import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WalletTransactionType } from '../../common/enums';
import { WalletService } from '../wallet/wallet.service';
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
  toEntitlement,
  toPublicEvent,
  toPublicPlan,
  toPublicSubscription,
} from './subscription.mapper';
import { MediaPlanDocument } from './schemas/media-plan.schema';
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
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
  ) {}

  requirePayment(): boolean {
    return this.config.get<boolean>('MEDIA_SUBSCRIPTION_REQUIRE_PAYMENT') !== false;
  }

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

  async getCurrentForUser(userId: string) {
    return this.findCurrent(userId);
  }

  async getEntitlement(userId: string) {
    const sub = await this.findCurrent(userId);
    return toEntitlement(sub);
  }

  async history(userId: string) {
    const events = await this.eventModel.find({ userId }).sort({ createdAt: -1 }).limit(100).exec();
    return events.map(toPublicEvent);
  }

  async planChanges(userId: string) {
    const events = await this.eventModel
      .find({
        userId,
        type: {
          $in: [
            SubscriptionEventType.Upgraded,
            SubscriptionEventType.Downgraded,
            SubscriptionEventType.PlanChanged,
          ],
        },
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
    return events.map(toPublicEvent);
  }

  async hasUsedTrial(userId: string): Promise<boolean> {
    const found = await this.subModel.exists({
      userId,
      trialStart: { $ne: null },
    });
    return Boolean(found);
  }

  async start(
    userId: string,
    planSlug: string,
    billingCycle: BillingCycle,
  ): Promise<{ subscription: MediaSubscriptionDocument; paymentRequired: boolean }> {
    const existing = await this.findCurrent(userId);
    if (existing && this.blocksNewSubscription(existing)) {
      throw new ConflictException(
        'An active or pending subscription already exists. Change or cancel it instead.',
      );
    }

    const plan = await this.plans.getActiveBySlug(planSlug);
    const now = new Date();
    const trialEligible = plan.trialDays > 0 && !(await this.hasUsedTrial(userId));
    const priceCents = priceForCycle(plan.monthlyPriceCents, plan.yearlyPriceCents, billingCycle);

    if (existing) {
      existing.isCurrent = false;
      await existing.save();
    }

    const snapshot = snapshotPlan(plan);
    let status: SubscriptionStatus;
    let trialStart: Date | null = null;
    let trialEnd: Date | null = null;
    let currentPeriodEnd: Date;
    let paymentProvider = 'none';
    let externalPaymentRef: string | null = null;

    if (trialEligible) {
      status = SubscriptionStatus.Trial;
      trialStart = now;
      trialEnd = addDays(now, plan.trialDays);
      currentPeriodEnd = trialEnd;
    } else if (this.requirePayment()) {
      const amountBdt = priceCents / 100;
      const txn = await this.wallet.debit({
        userId,
        amount: amountBdt,
        type: WalletTransactionType.Purchase,
        description: `Movie Server — ${plan.name} (${billingCycle})`,
        idempotencyKey: `media-sub:${userId}:${plan.slug}:${billingCycle}:${now.toISOString().slice(0, 10)}`,
        notify: true,
      });
      status = SubscriptionStatus.Active;
      currentPeriodEnd = addBillingCycle(now, billingCycle);
      paymentProvider = 'wallet';
      externalPaymentRef = String(txn._id);
    } else {
      status = SubscriptionStatus.Active;
      currentPeriodEnd = addBillingCycle(now, billingCycle);
      paymentProvider = 'internal';
    }

    const created = await this.subModel.create({
      userId: new Types.ObjectId(userId),
      ...snapshot,
      billingCycle,
      status,
      priceCents,
      autoRenew: true,
      cancelAtPeriodEnd: false,
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd,
      trialStart,
      trialEnd,
      paymentProvider,
      externalPaymentRef,
      isCurrent: true,
    });

    await this.recordEvent(created, SubscriptionEventType.Created, {
      toPlanSlug: plan.slug,
      toStatus: status,
      billingCycle,
      note: trialEligible ? 'Started with free trial.' : 'Subscription purchased.',
    });
    if (trialEligible) {
      await this.recordEvent(created, SubscriptionEventType.TrialStarted, {
        toPlanSlug: plan.slug,
        toStatus: status,
        billingCycle,
        note: `Trial for ${plan.trialDays} days.`,
      });
    } else if (status === SubscriptionStatus.Active) {
      await this.recordEvent(created, SubscriptionEventType.Activated, {
        toPlanSlug: plan.slug,
        toStatus: status,
        billingCycle,
        note: 'Activated after payment.',
      });
    }

    return { subscription: created, paymentRequired: false };
  }

  async changePlan(
    userId: string,
    planSlug: string,
    billingCycle: BillingCycle,
  ): Promise<MediaSubscriptionDocument> {
    const sub = await this.requireCurrent(userId);
    if (
      sub.status === SubscriptionStatus.Expired ||
      sub.status === SubscriptionStatus.Pending
    ) {
      throw new BadRequestException('Cannot change plan in the current subscription state.');
    }

    const plan = await this.plans.getActiveBySlug(planSlug);
    const samePlan = sub.planSlug === plan.slug && sub.billingCycle === billingCycle;
    if (samePlan && !sub.scheduledPlanId) {
      throw new BadRequestException('You are already on this plan and billing cycle.');
    }

    const upgrade =
      plan.rank > sub.planRank ||
      (plan.rank === sub.planRank && billingCycle === 'yearly' && sub.billingCycle === 'monthly');

    if (upgrade) {
      return this.applyImmediateChange(sub, plan, billingCycle, SubscriptionEventType.Upgraded);
    }

    sub.scheduledPlanId = plan._id;
    sub.scheduledBillingCycle = billingCycle;
    sub.scheduledChangeAt = sub.currentPeriodEnd;
    await sub.save();
    await this.recordEvent(sub, SubscriptionEventType.Downgraded, {
      fromPlanSlug: sub.planSlug,
      toPlanSlug: plan.slug,
      billingCycle,
      note: 'Downgrade scheduled for period end.',
    });
    return sub;
  }

  async cancel(userId: string): Promise<MediaSubscriptionDocument> {
    const sub = await this.requireCurrent(userId);
    if (sub.status === SubscriptionStatus.Expired) {
      throw new BadRequestException('Subscription is already expired.');
    }
    if (sub.status === SubscriptionStatus.Cancelled && sub.cancelAtPeriodEnd) {
      return sub;
    }
    const from = sub.status;
    sub.status = SubscriptionStatus.Cancelled;
    sub.cancelAtPeriodEnd = true;
    sub.autoRenew = false;
    sub.cancelledAt = new Date();
    sub.scheduledPlanId = null;
    sub.scheduledBillingCycle = null;
    sub.scheduledChangeAt = null;
    await sub.save();
    await this.recordEvent(sub, SubscriptionEventType.Cancelled, {
      fromStatus: from,
      toStatus: sub.status,
      note: 'Cancelled; access continues until period end.',
    });
    return sub;
  }

  async resume(userId: string): Promise<MediaSubscriptionDocument> {
    const sub = await this.requireCurrent(userId);
    if (sub.status !== SubscriptionStatus.Cancelled) {
      throw new BadRequestException('Only a cancelled subscription can be resumed.');
    }
    if (new Date() > sub.currentPeriodEnd) {
      throw new BadRequestException('The billing period has already ended.');
    }
    sub.status =
      sub.trialEnd && new Date() <= sub.trialEnd
        ? SubscriptionStatus.Trial
        : SubscriptionStatus.Active;
    sub.cancelAtPeriodEnd = false;
    sub.autoRenew = true;
    sub.cancelledAt = null;
    await sub.save();
    await this.recordEvent(sub, SubscriptionEventType.Resumed, {
      toStatus: sub.status,
      note: 'Cancellation undone.',
    });
    return sub;
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

  private blocksNewSubscription(sub: MediaSubscriptionDocument): boolean {
    if (sub.status === SubscriptionStatus.Pending) return true;
    if (sub.status === SubscriptionStatus.Expired) return false;
    const now = new Date();
    if (sub.status === SubscriptionStatus.Cancelled && now.getTime() > sub.currentPeriodEnd.getTime()) {
      return false;
    }
    return (
      sub.status === SubscriptionStatus.Trial ||
      sub.status === SubscriptionStatus.Active ||
      sub.status === SubscriptionStatus.Cancelled ||
      sub.status === SubscriptionStatus.Suspended
    );
  }

  private async requireCurrent(userId: string): Promise<MediaSubscriptionDocument> {
    const sub = await this.findCurrent(userId);
    if (!sub) {
      throw new NotFoundException('No subscription found.');
    }
    return sub;
  }

  private copyPlanOntoSubscription(
    sub: MediaSubscriptionDocument,
    plan: MediaPlanDocument,
    billingCycle: BillingCycle,
  ) {
    const snapshot = snapshotPlan(plan);
    sub.planId = snapshot.planId;
    sub.planSlug = snapshot.planSlug;
    sub.planRank = snapshot.planRank;
    sub.maxVideoQuality = snapshot.maxVideoQuality;
    sub.maxDevices = snapshot.maxDevices;
    sub.maxStreams = snapshot.maxStreams;
    sub.features = snapshot.features;
    sub.currency = snapshot.currency;
    sub.billingCycle = billingCycle;
    sub.priceCents = priceForCycle(plan.monthlyPriceCents, plan.yearlyPriceCents, billingCycle);
  }

  private async applyImmediateChange(
    sub: MediaSubscriptionDocument,
    plan: MediaPlanDocument,
    billingCycle: BillingCycle,
    type:
      | typeof SubscriptionEventType.Upgraded
      | typeof SubscriptionEventType.PlanChanged,
  ) {
    const fromSlug = sub.planSlug;
    const fromStatus = sub.status;
    this.copyPlanOntoSubscription(sub, plan, billingCycle);
    sub.scheduledPlanId = null;
    sub.scheduledBillingCycle = null;
    sub.scheduledChangeAt = null;
    await sub.save();
    await this.recordEvent(sub, type, {
      fromPlanSlug: fromSlug,
      toPlanSlug: plan.slug,
      fromStatus,
      toStatus: sub.status,
      billingCycle,
      note: 'Plan changed immediately.',
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
