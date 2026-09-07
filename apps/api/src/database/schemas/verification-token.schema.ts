import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TokenType } from '../../common/enums';

export type VerificationTokenDocument = HydratedDocument<VerificationToken>;

/** Short-lived hashed codes for email verification and OTP login. */
@Schema({ timestamps: true, collection: 'verification_tokens' })
export class VerificationToken {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ required: true, lowercase: true, index: true })
  email!: string;

  @Prop({ type: String, enum: Object.values(TokenType), required: true })
  type!: TokenType;

  @Prop({ required: true })
  codeHash!: string;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop({ default: false })
  consumed!: boolean;

  @Prop({ required: true })
  expiresAt!: Date;
}

export const VerificationTokenSchema =
  SchemaFactory.createForClass(VerificationToken);

// TTL: auto-remove expired codes.
VerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
