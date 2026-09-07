import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DeliverySettingsDocument = HydratedDocument<DeliverySettings>;

@Schema({ _id: false })
export class CustomOrderFieldDoc {
  @Prop({ required: true, trim: true })
  label!: string;

  @Prop({ default: true })
  enabled!: boolean;

  /** Pre-written messages — admin picks one when completing delivery. */
  @Prop({ type: [String], default: [] })
  messages!: string[];

  /** Region codes (e.g. GLOBAL, BD). Empty = all regions. */
  @Prop({ type: [String], default: [] })
  regions!: string[];
}

@Schema({ _id: false })
export class SavedDeliveryNoteDoc {
  @Prop({ required: true, trim: true })
  label!: string;

  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ trim: true, default: '' })
  note!: string;
}

@Schema({
  timestamps: true,
  collection: 'delivery_settings',
})
export class DeliverySettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  @Prop({ type: [CustomOrderFieldDoc], default: [] })
  customOrderFields!: CustomOrderFieldDoc[];

  @Prop({ type: [SavedDeliveryNoteDoc], default: [] })
  savedDeliveryNotes!: SavedDeliveryNoteDoc[];

  updatedAt?: Date;
}

export const DeliverySettingsSchema =
  SchemaFactory.createForClass(DeliverySettings);
