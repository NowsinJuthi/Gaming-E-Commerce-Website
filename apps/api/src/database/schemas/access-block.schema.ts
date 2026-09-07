import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AccessBlockDocument = HydratedDocument<AccessBlock>;

export type AccessBlockType = 'ip' | 'country';

/** Active IP or country deny rules enforced at the edge of the API. */
@Schema({
  timestamps: true,
  collection: 'access_blocks',
})
export class AccessBlock {
  @Prop({ required: true, enum: ['ip', 'country'], index: true })
  type!: AccessBlockType;

  /** Normalized IP address or ISO 3166-1 alpha-2 country code. */
  @Prop({ required: true, trim: true, index: true })
  value!: string;

  @Prop({ default: true, index: true })
  active!: boolean;

  @Prop({ trim: true, maxlength: 500 })
  reason?: string;

  @Prop({ trim: true })
  createdBy?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AccessBlockSchema = SchemaFactory.createForClass(AccessBlock);

AccessBlockSchema.index(
  { type: 1, value: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
AccessBlockSchema.index({ active: 1, type: 1, createdAt: -1 });
