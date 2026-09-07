import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import {
  AffiliateCommissionStatus,
  AffiliateStatus,
  NotificationEvent,
} from '../../common/enums';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { round2 } from '../../common/utils/money';
import { escapeRegex } from '../../common/utils/escape-regex';
import {
  AffiliateCommission,
  AffiliateCommissionDocument,
} from '../../database/schemas/affiliate-commission.schema';
import {
  AffiliateClick,
  AffiliateClickDocument,
} from '../../database/schemas/affiliate-click.schema';
import {
  AffiliateReferral,
  AffiliateReferralDocument,
} from '../../database/schemas/affiliate-referral.schema';
import {
  Affiliate,
  AffiliateDocument,
} from '../../database/schemas/affiliate.schema';
import { UserDocument } from '../../database/schemas/user.schema';
import type { AuthenticatedUser } from '../auth/auth.types';
import { NotificationDispatcher } from '../notifications/notification-dispatcher.service';
import { WalletService } from '../wallet/wallet.service';
import { QueryAffiliatesDto } from './dto/query-affiliates.dto';
import { QueryCommissionsDto } from './dto/query-commissions.dto';
import { UpdateAffiliateDto } from './dto/update-affiliate.dto';

export interface OrderCommissionInput {
  orderId: string;
  userId: string | Types.ObjectId;
  total: number;
  currency: string;
}

export interface PayoutReportRow {
  affiliateId: string;
  pending: number;
  paid: number;
  rejected: number;
  reversed: number;
  count: number;
}

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: number }).code === 11000;

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(
    @InjectModel(Affiliate.name)
    private readonly affiliateModel: Model<AffiliateDocument>,
    @InjectModel(AffiliateReferral.name)
    private readonly referralModel: Model<AffiliateReferralDocument>,
    @InjectModel(AffiliateClick.name)
    private readonly clickModel: Model<AffiliateClickDocument>,
    @InjectModel(AffiliateCommission.name)
    private readonly commissionModel: Model<AffiliateCommissionDocument>,
    private readonly wallet: WalletService,
    private readonly dispatcher: NotificationDispatcher,
    private readonly config: ConfigService,
  ) {}

  // --- Affiliate account + referral links ---

  async getDashboard(user: AuthenticatedUser): Promise<{
    affiliate: AffiliateDocument;
    referralCode: string;
    referralLink: string;
  }> {
    const affiliate = await this.ensureAffiliate(user.id);
    return {
      affiliate,
      referralCode: affiliate.code,
      referralLink: this.referralLink(affiliate.code),
    };
  }

  async ensureAffiliate(userId: string): Promise<AffiliateDocument> {
    const existing = await this.affiliateModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (existing) {
      return existing;
    }
    try {
      return await this.affiliateModel.create({
        userId: new Types.ObjectId(userId),
        code: await this.generateCode(),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const created = await this.affiliateModel
          .findOne({ userId: new Types.ObjectId(userId) })
          .exec();
        if (created) {
          return created;
        }
      }
      throw error;
    }
  }

  private referralLink(code: string): string {
    const appUrl =
      this.config.get<string>('payments.appUrl') ?? 'http://localhost:3000';
    return `${appUrl}/?ref=${code}`;
  }

  // --- Tracking ---

  async recordClick(
    code: string,
    meta: { ip?: string; userAgent?: string; landingPath?: string },
  ): Promise<{ tracked: boolean }> {
    const affiliate = await this.affiliateModel
      .findOne({ code, status: AffiliateStatus.Active })
      .exec();
    if (!affiliate) {
      return { tracked: false };
    }
    await this.clickModel.create({
      affiliateId: affiliate._id,
      code,
      ip: meta.ip,
      userAgent: meta.userAgent,
      landingPath: meta.landingPath,
    });
    await this.affiliateModel
      .updateOne({ _id: affiliate._id }, { $inc: { clicks: 1 } })
      .exec();
    return { tracked: true };
  }

  /** First-touch binding of a referred user to an affiliate code. */
  async attachReferral(
    user: AuthenticatedUser,
    code: string,
  ): Promise<AffiliateReferralDocument> {
    const affiliate = await this.affiliateModel
      .findOne({ code, status: AffiliateStatus.Active })
      .exec();
    if (!affiliate) {
      throw new NotFoundException('Invalid referral code');
    }
    if (String(affiliate.userId) === user.id) {
      throw new BadRequestException('You cannot refer yourself');
    }

    const referredUserId = new Types.ObjectId(user.id);
    const existing = await this.referralModel
      .findOne({ referredUserId })
      .exec();
    if (existing) {
      return existing; // first-touch wins; ignore later codes
    }
    try {
      const referral = await this.referralModel.create({
        affiliateId: affiliate._id,
        code,
        referredUserId,
      });
      await this.affiliateModel
        .updateOne({ _id: affiliate._id }, { $inc: { signups: 1 } })
        .exec();
      return referral;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const created = await this.referralModel
          .findOne({ referredUserId })
          .exec();
        if (created) {
          return created;
        }
      }
      throw error;
    }
  }

  // --- Commission (called by Orders) ---

  async recordCommissionForOrder(input: OrderCommissionInput): Promise<void> {
    const referral = await this.referralModel
      .findOne({ referredUserId: new Types.ObjectId(input.userId) })
      .exec();
    if (!referral) {
      return;
    }
    const affiliate = await this.affiliateModel
      .findById(referral.affiliateId)
      .exec();
    if (!affiliate || affiliate.status !== AffiliateStatus.Active) {
      return;
    }

    const rate = affiliate.commissionRate;
    const amount = round2(input.total * rate);
    if (amount <= 0) {
      return;
    }

    try {
      await this.commissionModel.create({
        affiliateId: affiliate._id,
        affiliateUserId: affiliate.userId,
        referredUserId: referral.referredUserId,
        orderId: new Types.ObjectId(input.orderId),
        baseAmount: round2(input.total),
        rate,
        amount,
        currency: input.currency,
        status: AffiliateCommissionStatus.Pending,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return; // commission already recorded for this order
      }
      throw error;
    }

    await this.affiliateModel
      .updateOne(
        { _id: affiliate._id },
        { $inc: { conversions: 1, totalPending: amount } },
      )
      .exec();
    if (!referral.convertedAt) {
      await this.referralModel
        .updateOne(
          { _id: referral._id },
          {
            $set: {
              convertedAt: new Date(),
              firstOrderId: new Types.ObjectId(input.orderId),
            },
          },
        )
        .exec();
    }
  }

  /** Reverses a commission when its order is refunded. */
  async reverseCommissionForOrder(orderId: string): Promise<void> {
    const commission = await this.commissionModel
      .findOne({ orderId: new Types.ObjectId(orderId) })
      .exec();
    if (!commission || commission.status === AffiliateCommissionStatus.Reversed) {
      return;
    }
    const wasPending =
      commission.status === AffiliateCommissionStatus.Pending;
    commission.status = AffiliateCommissionStatus.Reversed;
    commission.note = wasPending
      ? 'Reversed: order refunded'
      : 'Reversed: order refunded after payout (manual clawback required)';
    await commission.save();
    if (wasPending) {
      await this.affiliateModel
        .updateOne(
          { _id: commission.affiliateId },
          { $inc: { totalPending: -commission.amount } },
        )
        .exec();
    }
  }

  // --- Payout processing (admin) ---

  async approveCommission(
    commissionId: string,
  ): Promise<AffiliateCommissionDocument> {
    const commission = await this.commissionModel
      .findById(commissionId)
      .exec();
    if (!commission) {
      throw new NotFoundException('Commission not found');
    }
    if (commission.status !== AffiliateCommissionStatus.Pending) {
      throw new BadRequestException('Commission is not pending');
    }

    const txn = await this.wallet.affiliateCommission({
      userId: commission.affiliateUserId,
      amount: commission.amount,
      reference: { type: 'affiliate_commission', id: commission._id },
      idempotencyKey: `affcom:${String(commission._id)}`,
      description: 'Affiliate commission payout',
      notify: false,
    });

    commission.status = AffiliateCommissionStatus.Paid;
    commission.paidAt = new Date();
    commission.walletTransactionId = txn._id;
    await commission.save();

    await this.affiliateModel
      .updateOne(
        { _id: commission.affiliateId },
        {
          $inc: {
            totalPending: -commission.amount,
            totalEarned: commission.amount,
          },
        },
      )
      .exec();

    await this.dispatcher.dispatch(
      NotificationEvent.AffiliatePayout,
      commission.affiliateUserId,
      {
        amount: commission.amount,
        currency: commission.currency,
      },
    );
    return commission;
  }

  async rejectCommission(
    commissionId: string,
    note?: string,
  ): Promise<AffiliateCommissionDocument> {
    const commission = await this.commissionModel
      .findById(commissionId)
      .exec();
    if (!commission) {
      throw new NotFoundException('Commission not found');
    }
    if (commission.status !== AffiliateCommissionStatus.Pending) {
      throw new BadRequestException('Commission is not pending');
    }
    commission.status = AffiliateCommissionStatus.Rejected;
    commission.note = note;
    await commission.save();
    await this.affiliateModel
      .updateOne(
        { _id: commission.affiliateId },
        { $inc: { totalPending: -commission.amount } },
      )
      .exec();
    return commission;
  }

  // --- Reports / reads ---

  listMyCommissions(
    user: AuthenticatedUser,
    query: QueryCommissionsDto,
  ): Promise<PaginatedResult<AffiliateCommissionDocument>> {
    return this.listCommissions(
      { affiliateUserId: new Types.ObjectId(user.id) },
      query,
    );
  }

  adminListCommissions(
    query: QueryCommissionsDto,
  ): Promise<PaginatedResult<AffiliateCommissionDocument>> {
    return this.listCommissions({}, query);
  }

  async adminOverview(): Promise<{
    affiliates: { total: number; active: number; disabled: number };
    tracking: { clicks: number; signups: number; conversions: number };
    payouts: Omit<PayoutReportRow, 'affiliateId'>;
    defaultCommissionRate: number;
    referralLinkTemplate: string;
  }> {
    const [total, active, trackingRows, payouts] = await Promise.all([
      this.affiliateModel.countDocuments().exec(),
      this.affiliateModel
        .countDocuments({ status: AffiliateStatus.Active })
        .exec(),
      this.affiliateModel
        .aggregate<{ clicks: number; signups: number; conversions: number }>([
          {
            $group: {
              _id: null,
              clicks: { $sum: '$clicks' },
              signups: { $sum: '$signups' },
              conversions: { $sum: '$conversions' },
            },
          },
        ])
        .exec(),
      this.payoutReport(),
    ]);
    const tracking = trackingRows[0] ?? {
      clicks: 0,
      signups: 0,
      conversions: 0,
    };
    const appUrl =
      this.config.get<string>('payments.appUrl') ?? 'http://localhost:3000';
    return {
      affiliates: {
        total,
        active,
        disabled: total - active,
      },
      tracking,
      payouts: payouts.totals,
      defaultCommissionRate: 0.1,
      referralLinkTemplate: `${appUrl}/?ref={code}`,
    };
  }

  async adminListAffiliates(query: QueryAffiliatesDto): Promise<
    PaginatedResult<{
      _id: string;
      userId: string;
      email?: string;
      displayName?: string;
      code: string;
      status: AffiliateStatus;
      commissionRate: number;
      clicks: number;
      signups: number;
      conversions: number;
      totalEarned: number;
      totalPending: number;
      createdAt?: Date;
    }>
  > {
    const filter: FilterQuery<AffiliateDocument> = {};
    if (query.status) {
      filter.status = query.status;
    }
    if (query.q?.trim()) {
      filter.code = { $regex: escapeRegex(query.q.trim()), $options: 'i' };
    }
    const { page, limit } = query;
    const [items, total] = await Promise.all([
      this.affiliateModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate<{ userId: UserDocument }>('userId', 'email profile.displayName')
        .exec(),
      this.affiliateModel.countDocuments(filter).exec(),
    ]);
    return {
      items: items.map((a) => {
        const user =
          a.userId && typeof a.userId === 'object' ? a.userId : null;
        return {
          _id: String(a._id),
          userId: user ? String(user._id) : String(a.userId),
          email: user?.email,
          displayName: user?.profile?.displayName,
          code: a.code,
          status: a.status,
          commissionRate: a.commissionRate,
          clicks: a.clicks,
          signups: a.signups,
          conversions: a.conversions,
          totalEarned: a.totalEarned,
          totalPending: a.totalPending,
          createdAt: a.createdAt,
        };
      }),
      total,
      page,
      limit,
    };
  }

  async adminUpdateAffiliate(
    affiliateId: string,
    dto: UpdateAffiliateDto,
  ): Promise<AffiliateDocument> {
    const affiliate = await this.affiliateModel.findById(affiliateId).exec();
    if (!affiliate) {
      throw new NotFoundException('Affiliate not found');
    }
    if (dto.status !== undefined) {
      affiliate.status = dto.status;
    }
    if (dto.commissionRate !== undefined) {
      affiliate.commissionRate = dto.commissionRate;
    }
    await affiliate.save();
    return affiliate;
  }

  async payoutReport(): Promise<{
    totals: Omit<PayoutReportRow, 'affiliateId'>;
    affiliates: PayoutReportRow[];
  }> {
    const rows = await this.commissionModel
      .aggregate<{
        _id: { affiliateId: Types.ObjectId; status: AffiliateCommissionStatus };
        total: number;
        count: number;
      }>([
        {
          $group: {
            _id: { affiliateId: '$affiliateId', status: '$status' },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const byAffiliate = new Map<string, PayoutReportRow>();
    const totals = {
      pending: 0,
      paid: 0,
      rejected: 0,
      reversed: 0,
      count: 0,
    };

    for (const row of rows) {
      const affiliateId = String(row._id.affiliateId);
      const entry =
        byAffiliate.get(affiliateId) ??
        ({
          affiliateId,
          pending: 0,
          paid: 0,
          rejected: 0,
          reversed: 0,
          count: 0,
        } satisfies PayoutReportRow);
      this.applyStatus(entry, row._id.status, row.total, row.count);
      this.applyStatus(totals, row._id.status, row.total, row.count);
      byAffiliate.set(affiliateId, entry);
    }

    return { totals, affiliates: [...byAffiliate.values()] };
  }

  // --- Internals ---

  private applyStatus(
    target: {
      pending: number;
      paid: number;
      rejected: number;
      reversed: number;
      count: number;
    },
    status: AffiliateCommissionStatus,
    total: number,
    count: number,
  ): void {
    target.count += count;
    switch (status) {
      case AffiliateCommissionStatus.Pending:
        target.pending += total;
        break;
      case AffiliateCommissionStatus.Paid:
        target.paid += total;
        break;
      case AffiliateCommissionStatus.Rejected:
        target.rejected += total;
        break;
      case AffiliateCommissionStatus.Reversed:
        target.reversed += total;
        break;
    }
  }

  private async listCommissions(
    base: FilterQuery<AffiliateCommissionDocument>,
    query: QueryCommissionsDto,
  ): Promise<PaginatedResult<AffiliateCommissionDocument>> {
    const filter: FilterQuery<AffiliateCommissionDocument> = { ...base };
    if (query.status) {
      filter.status = query.status;
    }
    const { page, limit } = query;
    const [items, total] = await Promise.all([
      this.commissionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.commissionModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit };
  }

  private async generateCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = randomBytes(4).toString('hex').toUpperCase();
      const exists = await this.affiliateModel.exists({ code: candidate });
      if (!exists) {
        return candidate;
      }
    }
    throw new Error('Could not generate a unique affiliate code');
  }
}
