import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const CATALOG_KINDS = ['movie', 'series'] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

@Schema({ timestamps: true, collection: 'catalog_titles' })
export class CatalogTitle {
  @Prop({ type: String, enum: CATALOG_KINDS, required: true, index: true })
  kind!: CatalogKind;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title!: string;

  @Prop({ required: true, min: 1888, max: 2100 })
  year!: number;

  @Prop({ default: false, index: true })
  published!: boolean;

  @Prop({ type: String, enum: ['available', 'unavailable'], default: 'available' })
  availability!: 'available' | 'unavailable';

  @Prop({ default: false })
  featured!: boolean;

  @Prop({ default: false })
  trending!: boolean;

  @Prop({ type: String, default: null })
  posterUrl?: string | null;

  @Prop({ type: String, default: null })
  backdropUrl?: string | null;

  @Prop({ type: String, default: null })
  overview?: string | null;

  @Prop({ type: Number, default: null })
  runtimeMinutes?: number | null;

  @Prop({ type: Number, default: null })
  rating?: number | null;

  @Prop({ type: [String], default: [] })
  genres?: string[];

  @Prop({ type: [String], default: [] })
  directors?: string[];

  @Prop({ type: [String], default: [] })
  writers?: string[];

  @Prop({
    type: [
      {
        name: { type: String, required: true },
        profileUrl: { type: String, default: null },
      },
    ],
    default: [],
  })
  cast?: { name: string; profileUrl?: string | null }[];

  @Prop({ default: false })
  detailsLoaded?: boolean;

  @Prop({ type: String, default: null })
  videoFileName?: string | null;

  @Prop({ type: Number, default: null })
  videoFileSizeBytes?: number | null;

  @Prop({ type: Number, default: null })
  seasonCount?: number | null;

  /** Stable id for a file or folder imported from a media library. */
  @Prop({ type: String })
  sourceKey?: string;
}

export type CatalogTitleDocument = HydratedDocument<CatalogTitle>;
export const CatalogTitleSchema = SchemaFactory.createForClass(CatalogTitle);
CatalogTitleSchema.index({ kind: 1, title: 1 });
CatalogTitleSchema.index({ sourceKey: 1 }, { unique: true, sparse: true });
