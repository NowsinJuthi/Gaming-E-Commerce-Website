import { DEFAULT_CURRENCY } from '@uniqbd/types';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VoucherStatus } from '../../common/enums';

export type VoucherDocument = HydratedDocument<Voucher>;

/** A prepaid, single-use stored-value code (gift voucher). */
@Schema({ timestamps: true, collection: 'vouchers' })
export class Voucher {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ default: DEFAULT_CURRENCY })
  currency!: string;

  @Prop({
    type: String,
    enum: Object.values(VoucherStatus),
    default: VoucherStatus.Active,
    index: true,
  })
  status!: VoucherStatus;

  /** When set, only this user may redeem the voucher. */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assignedUserId?: Types.ObjectId;

  @Prop()
  expiresAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  redeemedBy?: Types.ObjectId;

  @Prop()
  redeemedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;
}

export const VoucherSchema = SchemaFactory.createForClass(Voucher);
