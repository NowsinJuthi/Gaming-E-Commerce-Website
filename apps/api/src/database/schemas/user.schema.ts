import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { KycStatus, Role, UserStatus } from '../../common/enums';

@Schema({ _id: false })
export class UserProfile {
  @Prop({ trim: true })
  firstName?: string;

  @Prop({ trim: true })
  lastName?: string;

  @Prop({ trim: true })
  displayName?: string;

  @Prop()
  avatarUrl?: string;

  @Prop()
  country?: string;

  @Prop()
  locale?: string;

  @Prop()
  timezone?: string;

  @Prop()
  bio?: string;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ index: true, sparse: true, trim: true })
  phone?: string;

  @Prop({ required: false, select: false })
  passwordHash?: string;

  @Prop({ type: [String], enum: Object.values(Role), default: [Role.Customer] })
  roles!: Role[];

  @Prop({
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.Pending,
  })
  status!: UserStatus;

  @Prop({ default: false })
  emailVerified!: boolean;

  /** Temporary storefront session for checkout without registration. */
  @Prop({ default: false, index: true })
  isGuest!: boolean;

  @Prop({
    type: String,
    enum: Object.values(KycStatus),
    default: KycStatus.None,
  })
  kycStatus!: KycStatus;

  @Prop({ type: UserProfileSchema, default: {} })
  profile!: UserProfile;

  /** Internal note visible to admins only. */
  @Prop({ trim: true, maxlength: 4000 })
  adminNote?: string;

  /** Incremented on password change/reset so outstanding access JWTs die immediately. */
  @Prop({ default: 0 })
  tokenVersion?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
