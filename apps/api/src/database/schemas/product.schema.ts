import { DEFAULT_CURRENCY } from '@uniqbd/types';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  DeliveryType,
  ProductStatus,
  ProductType,
} from '../../common/enums';
import { Seo, SeoSchema } from './seo.schema';

@Schema({ _id: false })
export class ProductPricing {
  @Prop({ default: DEFAULT_CURRENCY })
  currency!: string;

  @Prop({ default: 0 })
  cost!: number;

  @Prop({ required: true, min: 0 })
  basePrice!: number;

  @Prop()
  compareAt?: number;
}
export const ProductPricingSchema = SchemaFactory.createForClass(ProductPricing);

@Schema({ _id: false })
export class ProductStock {
  @Prop({ default: 0 })
  available!: number;

  @Prop({ default: 0 })
  reserved!: number;

  @Prop({ default: 0 })
  sold!: number;
}
export const ProductStockSchema = SchemaFactory.createForClass(ProductStock);

@Schema({ _id: false })
export class ProductMedia {
  @Prop({ required: true })
  url!: string;

  @Prop()
  type?: string;

  @Prop()
  alt?: string;
}
export const ProductMediaSchema = SchemaFactory.createForClass(ProductMedia);

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug!: string;

  @Prop()
  description?: string;

  /** Lowercased title used for index-backed prefix autocomplete. */
  @Prop({ lowercase: true, trim: true })
  titleNormalized?: string;

  @Prop({ unique: true, sparse: true, trim: true })
  sku?: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  categoryId!: Types.ObjectId;

  /** All catalog categories this product belongs to (first entry mirrors categoryId). */
  @Prop({ type: [Types.ObjectId], ref: 'Category', default: [], index: true })
  categoryIds!: Types.ObjectId[];

  /** Materialized category ancestors + self, for subtree filtering. */
  @Prop({ type: [Types.ObjectId], ref: 'Category', default: [], index: true })
  categoryPath!: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Brand', index: true })
  brandId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Supplier', index: true })
  supplierId?: Types.ObjectId;

  /** User who created this product. Suppliers may mutate only their own rows. */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  ownerUserId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ProductType),
    required: true,
  })
  type!: ProductType;

  @Prop({
    type: String,
    enum: Object.values(DeliveryType),
    default: DeliveryType.Auto,
  })
  deliveryType!: DeliveryType;

  @Prop({ type: ProductPricingSchema, required: true })
  pricing!: ProductPricing;

  @Prop({ type: ProductStockSchema, default: {} })
  stock!: ProductStock;

  @Prop({ type: Object, default: {} })
  attributes?: Record<string, unknown>;

  @Prop({ type: [ProductMediaSchema], default: [] })
  media!: ProductMedia[];

  /** Region codes where the product is sellable (ISO country code or GLOBAL). */
  @Prop({ type: [String], default: ['GLOBAL'], index: true })
  availableRegions!: string[];

  @Prop({ type: SeoSchema, default: {} })
  seo?: Seo;

  @Prop({
    type: String,
    enum: Object.values(ProductStatus),
    default: ProductStatus.Draft,
    index: true,
  })
  status!: ProductStatus;

  @Prop({ type: Object, default: { avg: 0, count: 0 } })
  ratings?: { avg: number; count: number };

  /** When true, this product is shown on the homepage even when "featured only" mode is on. */
  @Prop({ default: false, index: true })
  featured!: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// --- Indexes tuned for large-catalog reads (ESR: Equality, Sort, Range) ---
// Weighted text index powers instant full-text search (title ranks above body).
ProductSchema.index(
  { title: 'text', description: 'text' },
  { weights: { title: 10, description: 3 }, name: 'product_text' },
);
// Index-backed prefix autocomplete (anchored ^regex on a lowercased field).
ProductSchema.index({ status: 1, titleNormalized: 1 });
ProductSchema.index({ status: 1, categoryPath: 1, 'pricing.basePrice': 1 });
ProductSchema.index({ status: 1, categoryIds: 1, createdAt: -1 });
ProductSchema.index({ status: 1, brandId: 1, createdAt: -1 });
ProductSchema.index({ status: 1, availableRegions: 1, createdAt: -1, _id: -1 });
ProductSchema.index({ status: 1, createdAt: -1, _id: -1 });
ProductSchema.index({ status: 1, updatedAt: -1, _id: -1 });
ProductSchema.index({ status: 1, 'pricing.basePrice': 1, _id: 1 });
