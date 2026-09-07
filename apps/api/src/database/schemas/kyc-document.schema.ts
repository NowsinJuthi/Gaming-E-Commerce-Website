import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { KycDocumentType, KycStatus } from '../../common/enums';

export type KycDocumentEntity = HydratedDocument<KycDocument>;

@Schema({ timestamps: true, collection: 'kyc_documents' })
export class KycDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(KycDocumentType),
    required: true,
  })
  documentType!: KycDocumentType;

  @Prop({ type: [String], default: [] })
  fileUrls!: string[];

  @Prop({
    type: String,
    enum: Object.values(KycStatus),
    default: KycStatus.Pending,
  })
  status!: KycStatus;

  @Prop()
  rejectionReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const KycDocumentSchema = SchemaFactory.createForClass(KycDocument);

// Admin review queue: pending-first, newest within status.
KycDocumentSchema.index({ status: 1, createdAt: -1 });
// A user's own submissions filtered by status.
KycDocumentSchema.index({ userId: 1, status: 1 });
