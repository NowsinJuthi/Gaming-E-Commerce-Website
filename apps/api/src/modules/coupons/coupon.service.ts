import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { CouponType } from '../../common/enums';
import { round2 } from '../../common/utils/money';
import { Coupon, CouponDocument } from '../../database/schemas/coupon.schema';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import { CreateCouponDto } from './dto/create-coupon.dto';

export interface CouponEvaluation {
  valid: boolean;
  discount: number;
  code?: string;
  reason?: string;
}

@Injectable()
export class CouponService {
  constructor(
    @InjectModel(Coupon.name)
    private readonly couponModel: Model<CouponDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {}

  async create(dto: CreateCouponDto): Promise<CouponDocument> {
    const code = (dto.code ?? this.generateCode()).toUpperCase();
    const existing = await this.couponModel.exists({ code });
    if (existing) {
      throw new ConflictException('Coupon code already exists');
    }
    return this.couponModel.create({
      code,
      type: dto.type,
      value: dto.value,
      minSubtotal: dto.minSubtotal ?? 0,
      maxDiscount: dto.maxDiscount,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      usageLimit: dto.usageLimit,
      perUserLimit: dto.perUserLimit,
      isActive: dto.isActive ?? true,
    });
  }

  list(): Promise<CouponDocument[]> {
    return this.couponModel.find().sort({ createdAt: -1 }).exec();
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const result = await this.couponModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Coupon not found');
    }
    return { success: true };
  }

  /**
   * Validates a coupon against a subtotal and computes the discount. When a
   * `userId` is supplied, the per-user redemption cap is also enforced by
   * counting the buyer's previously redeemed orders that used this coupon.
   */
  async evaluate(
    code: string,
    subtotal: number,
    userId?: string,
  ): Promise<CouponEvaluation> {
    const coupon = await this.couponModel
      .findOne({ code: code.toUpperCase() })
      .exec();
    if (!coupon || !coupon.isActive) {
      return { valid: false, discount: 0, reason: 'Invalid coupon code' };
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      return { valid: false, discount: 0, reason: 'Coupon is not active yet' };
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return { valid: false, discount: 0, reason: 'Coupon has expired' };
    }
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, discount: 0, reason: 'Coupon usage limit reached' };
    }
    if (
      userId &&
      coupon.perUserLimit != null &&
      (await this.userRedemptionCount(coupon.code, userId)) >=
        coupon.perUserLimit
    ) {
      return {
        valid: false,
        discount: 0,
        code: coupon.code,
        reason: 'You have already used this coupon the maximum number of times',
      };
    }
    if (subtotal < coupon.minSubtotal) {
      return {
        valid: false,
        discount: 0,
        code: coupon.code,
        reason: `Minimum subtotal of ${coupon.minSubtotal} required`,
      };
    }

    let discount =
      coupon.type === CouponType.Percent
        ? (subtotal * coupon.value) / 100
        : coupon.value;
    if (coupon.maxDiscount != null) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
    discount = round2(Math.min(discount, subtotal));

    return { valid: true, discount, code: coupon.code };
  }

  /** Counts the buyer's orders that have actually redeemed this coupon. */
  private async userRedemptionCount(
    code: string,
    userId: string,
  ): Promise<number> {
    return this.orderModel
      .countDocuments({
        userId: new Types.ObjectId(userId),
        'pricing.couponCode': code.toUpperCase(),
        promotionsRedeemed: true,
      })
      .exec();
  }

  /**
   * Increments global usage once payment is confirmed. The conditional filter
   * makes the increment atomic so concurrent redemptions can never push
   * `usedCount` past `usageLimit`.
   */
  async redeem(code: string): Promise<boolean> {
    const normalized = code.toUpperCase();
    const result = await this.couponModel
      .updateOne(
        {
          code: normalized,
          $or: [
            { usageLimit: { $exists: false } },
            { usageLimit: null },
            { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
          ],
        },
        { $inc: { usedCount: 1 } },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  private generateCode(): string {
    return randomBytes(6).toString('hex').toUpperCase();
  }
}
