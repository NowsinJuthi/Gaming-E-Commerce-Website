import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { WalletStatus } from '../../common/enums';

export type WalletDocument = HydratedDocument<Wallet>;

/**
 * One wallet per user. `balance` is spendable; `pendingBalance` holds funds
 * reserved for in-flight withdrawals. Monetary values use `number` for
 * consistency with the rest of the codebase (rounded via round2 on write);
 * migrate to Decimal128 if sub-paisa precision is ever required.
 */
@Schema({ timestamps: true, collection: 'wallets' })
export class Wallet {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ default: 0, min: 0 })
  balance!: number;

  @Prop({ default: 0, min: 0 })
  pendingBalance!: number;

  @Prop({ default: 'BDT' })
  currency!: string;

  @Prop({
    type: String,
    enum: Object.values(WalletStatus),
    default: WalletStatus.Active,
  })
  status!: WalletStatus;

  @Prop({ default: 0 })
  totalCredited!: number;

  @Prop({ default: 0 })
  totalDebited!: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
