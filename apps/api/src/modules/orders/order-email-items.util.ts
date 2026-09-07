import { Types, type Model } from 'mongoose';
import type { EffectiveEmailSettings } from '../../integrations/mail/email-settings.service';
import {
  emailAssetUrl,
  toEmailOrderItems,
  type EmailOrderItem,
} from '../../integrations/mail/email-templates';
import type { OrderItem } from '../../database/schemas/order.schema';
import type { ProductDocument } from '../../database/schemas/product.schema';

function resolveLineThumbnail(
  product: {
    media?: Array<{ url?: string }>;
    attributes?: Record<string, unknown>;
  },
  variationValueId?: string,
): string | undefined {
  const base = product.media?.[0]?.url?.trim();
  if (!variationValueId) {
    return base || undefined;
  }

  const raw = product.attributes?.variations;
  if (!Array.isArray(raw)) {
    return base || undefined;
  }

  const variation = raw.find(
    (row) =>
      String((row as { valueId?: string }).valueId ?? '') === variationValueId,
  ) as { imageUrl?: string } | undefined;

  if (variation?.imageUrl?.trim()) {
    return variation.imageUrl.trim();
  }

  return base || undefined;
}

export async function buildEmailOrderItemsFromOrder(
  items: OrderItem[],
  productModel: Model<ProductDocument>,
  settings: EffectiveEmailSettings,
): Promise<EmailOrderItem[]> {
  const base = toEmailOrderItems(items);
  if (!base.length) {
    return base;
  }

  const productIds = [...new Set(items.map((it) => String(it.productId)))];
  const products = await productModel
    .find({ _id: { $in: productIds.map((id) => new Types.ObjectId(id)) } })
    .select('media attributes')
    .lean()
    .exec();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  return base.map((line, idx) => {
    const source = items[idx];
    if (!source) return line;

    const product = byId.get(String(source.productId));
    if (!product) return line;

    const imageUrl = emailAssetUrl(
      settings,
      resolveLineThumbnail(product, source.variationValueId),
    );

    return imageUrl ? { ...line, imageUrl } : line;
  });
}
