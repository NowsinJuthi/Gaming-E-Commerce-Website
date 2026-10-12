import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const MEDIA_LIBRARY_KINDS = ['movies', 'tv'] as const;
export type MediaLibraryKind = (typeof MEDIA_LIBRARY_KINDS)[number];

@Schema({ timestamps: true, collection: 'media_libraries' })
export class MediaLibrary {
  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ type: String, enum: MEDIA_LIBRARY_KINDS, required: true, index: true })
  kind!: MediaLibraryKind;

  @Prop({ type: String, enum: ['local', 'smb'], default: 'local' })
  provider!: 'local' | 'smb';

  @Prop({ required: true })
  rootPath!: string;

  @Prop({ default: true, index: true })
  enabled!: boolean;

  @Prop({ type: String, default: null })
  imageUrl?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'SmbServer', default: null, index: true })
  smbServerId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  smbShare?: string | null;

  @Prop({ type: String, default: null })
  smbRemotePath?: string | null;

  @Prop({ default: 0 })
  itemCount!: number;

  @Prop({ default: 0 })
  missingCount!: number;

  @Prop({ default: 0 })
  unmatchedCount!: number;
}

export type MediaLibraryDocument = HydratedDocument<MediaLibrary>;
export const MediaLibrarySchema = SchemaFactory.createForClass(MediaLibrary);
MediaLibrarySchema.index({ kind: 1, name: 1 }, { unique: true });
