import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'smb_servers' })
export class SmbServer {
  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ required: true, trim: true, maxlength: 255 })
  host!: string;

  @Prop({ default: 445, min: 1, max: 65535 })
  port!: number;

  @Prop({ required: true, trim: true, maxlength: 128 })
  username!: string;

  @Prop({ required: true, select: false })
  passwordEnc!: string;

  @Prop({ default: 'WORKGROUP', trim: true, maxlength: 64 })
  domain!: string;

  @Prop({ required: true, trim: true, maxlength: 128 })
  share!: string;

  @Prop({ default: true, index: true })
  enabled!: boolean;

  @Prop({ type: Date, default: null })
  lastOkAt?: Date | null;

  @Prop({ type: String, default: null })
  lastError?: string | null;
}

export type SmbServerDocument = HydratedDocument<SmbServer>;
export const SmbServerSchema = SchemaFactory.createForClass(SmbServer);
SmbServerSchema.index({ host: 1, share: 1, username: 1 }, { unique: true });
