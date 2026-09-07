import { getProduct, type ProductDetail } from "@/lib/api";
import { parseOrderItemPackage } from "@/lib/admin-order-view";
import { parseProductVariations } from "@/lib/product-page";

const productBySlug = new Map<string, Promise<ProductDetail | null>>();
const imageByItemKey = new Map<string, string | null>();

function resolveItemImageUrl(
  product: ProductDetail | null,
  itemTitle: string,
): string | undefined {
  if (!product) return undefined;
  const fallback = product.media?.[0]?.url;
  const { packageName } = parseOrderItemPackage(itemTitle);
  if (!packageName?.trim()) return fallback;
  const match = parseProductVariations(product.attributes).find(
    (variation) => variation.name.trim() === packageName.trim(),
  );
  return match?.imageUrl?.trim()
    ? match.imageUrl.trim()
    : fallback;
}

function fetchProduct(slug: string): Promise<ProductDetail | null> {
  let pending = productBySlug.get(slug);
  if (!pending) {
    pending = getProduct(slug).catch(() => null);
    productBySlug.set(slug, pending);
  }
  return pending;
}

export async function loadOrderItemImage(
  itemKey: string,
  slug: string,
  itemTitle: string,
): Promise<string | undefined> {
  if (imageByItemKey.has(itemKey)) {
    const cached = imageByItemKey.get(itemKey);
    return cached ?? undefined;
  }

  const product = await fetchProduct(slug);
  const url = resolveItemImageUrl(product, itemTitle) ?? null;
  imageByItemKey.set(itemKey, url);
  return url ?? undefined;
}

export function orderItemImageKey(
  items: Array<{ productId: string; slug: string; title: string }>,
): string {
  return items
    .map((item, index) => `${item.productId}:${item.slug}:${index}:${item.title}`)
    .join("|");
}
