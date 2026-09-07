import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuthSessionDocument = HydratedDocument<AuthSession>;

/** Stores hashed refresh tokens — supports multi-device, rotation and revocation. */
@Schema({ timestamps: true, collection: 'auth_sessions' })
export class AuthSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  tokenHash!: string;

  @Prop()
  userAgent?: string;

  @Prop()
  ip?: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: false })
  revoked!: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AuthSessionSchema = SchemaFactory.createForClass(AuthSession);

// TTL: auto-remove expired sessions.
AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
