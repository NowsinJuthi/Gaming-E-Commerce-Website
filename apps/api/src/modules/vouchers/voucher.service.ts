import { DEFAULT_CURRENCY } from '@uniqbd/types';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { VoucherStatus } from '../../common/enums';
import {
  Voucher,
  VoucherDocument,
} from '../../database/schemas/voucher.schema';
import { CreateVoucherDto } from './dto/create-voucher.dto';

export interface VoucherEvaluation {
  valid: boolean;
  amount: number;
  code?: string;
  reason?: string;
}

@Injectable()
export class VoucherService {
  constructor(
    @InjectModel(Voucher.name)
    private readonly voucherModel: Model<VoucherDocument>,
  ) {}

  async create(dto: CreateVoucherDto): Promise<VoucherDocument> {
    const code = (dto.code ?? this.generateCode()).toUpperCase();
    const existing = await this.voucherModel.exists({ code });
    if (existing) {
      throw new ConflictException('Voucher code already exists');
    }
    return this.voucherModel.create({
      code,
      amount: dto.amount,
      currency: dto.currency ?? DEFAULT_CURRENCY,
      status: VoucherStatus.Active,
      assignedUserId: dto.assignedUserId
        ? new Types.ObjectId(dto.assignedUserId)
        : undefined,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  list(): Promise<VoucherDocument[]> {
    return this.voucherModel.find().sort({ createdAt: -1 }).limit(200).exec();
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const result = await this.voucherModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Voucher not found');
    }
    return { success: true };
  }

  /** Validates a voucher for a given user without redeeming it. */
  async evaluate(code: string, userId: string): Promise<VoucherEvaluation> {
    const voucher = await this.voucherModel
      .findOne({ code: code.toUpperCase() })
      .exec();
    if (!voucher || voucher.status !== VoucherStatus.Active) {
      return { valid: false, amount: 0, reason: 'Invalid or used voucher' };
    }
    if (voucher.expiresAt && voucher.expiresAt < new Date()) {
      return { valid: false, amount: 0, reason: 'Voucher has expired' };
    }
    if (
      voucher.assignedUserId &&
      String(voucher.assignedUserId) !== userId
    ) {
      return {
        valid: false,
        amount: 0,
        reason: 'Voucher is not assigned to this account',
      };
    }
    return { valid: true, amount: voucher.amount, code: voucher.code };
  }

  /**
   * Marks a voucher as redeemed against an order. The `status: Active` filter
   * makes this atomic and idempotent: only the first redemption flips the
   * status, so a voucher can never be consumed by two orders. Returns whether
   * this call actually performed the redemption.
   */
  async redeem(
    code: string,
    userId: string,
    orderId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.voucherModel
      .updateOne(
        { code: code.toUpperCase(), status: VoucherStatus.Active },
        {
          $set: {
            status: VoucherStatus.Redeemed,
            redeemedBy: new Types.ObjectId(userId),
            redeemedAt: new Date(),
            orderId,
          },
        },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  private generateCode(): string {
    return randomBytes(8).toString('hex').toUpperCase();
  }
}
