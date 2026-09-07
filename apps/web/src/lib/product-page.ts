import type { ProductDetail } from "@/lib/api";
import { sanitizeHtml } from "@/lib/sanitize";
import { resolveMediaSrc } from "@/lib/site-appearance";

export type ProductVariation = {
  id: string;
  name: string;
  valueId: string;
  price: number;
  imageUrl: string;
  stockType?: "giftcard" | "manual" | "api";
  manualStock?: number;
  regions?: string[];
};

function normalizeRegionCode(value: string): string {
  return value.trim().toUpperCase();
}

export { normalizeRegionCode };

export function resolvePackageRegions(
  variationRegions: string[] | undefined,
  productRegions?: string[],
): string[] {
  const source =
    variationRegions?.length ? variationRegions : (productRegions ?? []);
  return [...new Set(source.map(normalizeRegionCode).filter(Boolean))];
}

export function resolveProductPageRegions(
  product: Pick<ProductDetail, "availableRegions">,
  selectedPkg: PackageOption | undefined,
  packages: PackageOption[],
): string[] {
  return collectSelectableRegions(
    resolvePackageRegions(product.availableRegions),
    packages,
  );
}

export function collectSelectableRegions(
  productRegions: string[],
  packages: PackageOption[],
): string[] {
  const merged = new Set<string>();
  for (const region of productRegions) {
    merged.add(region);
  }
  for (const pkg of packages) {
    for (const region of pkg.regions) {
      merged.add(region);
    }
  }
  return [...merged];
}

export function getProductDefaultRegion(
  attrs: Record<string, unknown> | undefined,
  availableRegions: string[] | undefined,
  packages: PackageOption[],
): string | null {
  const selectable = collectSelectableRegions(
    resolvePackageRegions(availableRegions),
    packages,
  );
  if (selectable.length === 0) return null;

  const configured =
    typeof attrs?.defaultRegion === "string"
      ? normalizeRegionCode(attrs.defaultRegion)
      : "";
  const configuredMatch = selectable.find(
    (region) => normalizeRegionCode(region) === configured,
  );
  if (configuredMatch) {
    return configuredMatch;
  }

  const productRegions = resolvePackageRegions(availableRegions);
  const firstProductRegion = productRegions[0];
  if (firstProductRegion) return firstProductRegion;
  return selectable[0] ?? null;
}

export function packageMatchesRegion(
  pkg: PackageOption,
  region: string,
  productRegions: string[],
): boolean {
  const normalized = normalizeRegionCode(region);
  if (!normalized) return true;

  if (pkg.regions.length > 0) {
    return pkg.regions.some(
      (entry) => normalizeRegionCode(entry) === normalized,
    );
  }

  if (productRegions.length > 0) {
    return productRegions.some(
      (entry) => normalizeRegionCode(entry) === normalized,
    );
  }

  return true;
}

export function filterPackagesByRegion(
  packages: PackageOption[],
  region: string | null,
  productRegions: string[],
): PackageOption[] {
  if (!region) return packages;
  return packages.filter((pkg) =>
    packageMatchesRegion(pkg, region, productRegions),
  );
}

export function parseProductVariations(
  attrs?: Record<string, unknown>,
): ProductVariation[] {
  const raw = attrs?.variations;
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const v = item as Record<string, unknown>;
    const stockType = v.stockType as ProductVariation["stockType"];
    const regions = Array.isArray(v.regions)
      ? [
          ...new Set(
            v.regions
              .map((region) => normalizeRegionCode(String(region)))
              .filter(Boolean),
          ),
        ]
      : undefined;
    return {
      id: `var-${i}`,
      name: String(v.name ?? ""),
      valueId: String(v.valueId ?? i),
      price: Number(v.price ?? 0),
      imageUrl: String(v.imageUrl ?? ""),
      stockType:
        stockType === "giftcard" ||
        stockType === "manual" ||
        stockType === "api"
          ? stockType
          : undefined,
      manualStock:
        v.manualStock !== undefined ? Number(v.manualStock) : undefined,
      ...(regions?.length ? { regions } : {}),
    };
  });
}

export type CustomerInputBox = {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
};

export function parseCustomerInputBoxes(
  attrs?: Record<string, unknown>,
): CustomerInputBox[] {
  const raw = attrs?.customerInputBoxes;
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const v = item as Record<string, unknown>;
    return {
      id: `cib-${i}`,
      label: String(v.label ?? ""),
      placeholder: String(v.placeholder ?? ""),
      required: Boolean(v.required),
    };
  });
}

export function getShortDescription(attrs?: Record<string, unknown>): string {
  if (typeof attrs?.shortDescription === "string") {
    return attrs.shortDescription;
  }
  return "";
}

/** True when sanitized HTML still has visible text (ignores empty editor markup). */
export function hasProductHtmlContent(html: string): boolean {
  if (!html) return false;
  return html.replace(/<[^>]+>/g, "").trim().length > 0;
}

/** Storefront short description — WordPress-style sanitized HTML. */
export function getShortDescriptionHtml(attrs?: Record<string, unknown>): string {
  return sanitizeHtml(getShortDescription(attrs));
}

/** Storefront long description — WordPress-style sanitized HTML. */
export function getProductDescriptionHtml(description?: string | null): string {
  return sanitizeHtml(description);
}

/** When true, variation package images appear in the storefront product gallery. */
export function showVariationImagesInGallery(
  attrs?: Record<string, unknown>,
): boolean {
  return attrs?.showVariationImagesInGallery === true;
}

export type ProductGalleryImage = {
  id: string;
  url: string;
  alt: string;
  source: "media" | "variation";
  packageName?: string;
};

/** First product media URL used when a package has no image. */
export function getProductFallbackImageUrl(
  product: Pick<ProductDetail, "media">,
): string {
  return product.media?.[0]?.url?.trim() ?? "";
}

export function resolveVariationImageUrl(
  variationImageUrl: string | undefined,
  fallbackImageUrl?: string,
): string {
  const own = variationImageUrl?.trim() ?? "";
  if (own) return resolveMediaSrc(own);
  const fallback = fallbackImageUrl?.trim() ?? "";
  return fallback ? resolveMediaSrc(fallback) : "";
}

/** Images shown in the product view gallery (media + optional package images). */
export function buildProductGalleryImages(
  product: Pick<ProductDetail, "title" | "media" | "attributes">,
  variations: ProductVariation[],
): ProductGalleryImage[] {
  const includePackages = showVariationImagesInGallery(product.attributes);
  const fallbackImage = getProductFallbackImageUrl(product);
  const seen = new Set<string>();
  const items: ProductGalleryImage[] = [];

  for (const [index, media] of (product.media ?? []).entries()) {
    const url = resolveMediaSrc(media.url?.trim() ?? "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    items.push({
      id: `media-${index}`,
      url,
      alt: media.alt?.trim() || product.title,
      source: "media",
    });
  }

  if (includePackages) {
    for (const variation of variations) {
      const url = resolveVariationImageUrl(variation.imageUrl, fallbackImage);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      items.push({
        id: variation.id,
        url,
        alt: variation.name || product.title,
        source: "variation",
        packageName: variation.name,
      });
    }
  }

  return items;
}

export function galleryImageUrls(
  product: Pick<ProductDetail, "title" | "media" | "attributes">,
  variations: ProductVariation[],
): string[] {
  return buildProductGalleryImages(product, variations).map((item) => item.url);
}

const TYPE_LABEL: Record<string, string> = {
  license: "Games",
  account: "Account",
  giftcard: "Gift Card",
  topup: "Top-Up",
  subscription: "Subscription",
};

export function getProductCategoryTag(product: ProductDetail): string {
  const attrs = product.attributes;
  if (typeof attrs?.categoryTag === "string" && attrs.categoryTag.trim()) {
    return attrs.categoryTag.trim();
  }
  const first = product.title.split(/\s+/)[0];
  if (first && first.length <= 12) return first;
  return TYPE_LABEL[product.type] ?? product.type;
}

function packageInventoryMap(
  product: Pick<ProductDetail, "packageInventory">,
): Map<string, number> {
  return new Map(
    (product.packageInventory ?? []).map((row) => [
      String(row.valueId),
      Math.max(0, row.available),
    ]),
  );
}

export type PackageOption = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  inStock: boolean;
  availableCount: number;
  /** Admin-declared manual stock, used as a display floor when > availableCount. */
  manualStock: number;
  instantDelivery: boolean;
  regions: string[];
};

function variationHasInstantDelivery(
  variation: ProductVariation,
  isAutoDelivery: boolean,
): boolean {
  if (variation.stockType === "manual") return false;
  return (
    variation.stockType === "giftcard" ||
    variation.stockType === "api" ||
    isAutoDelivery
  );
}

export function productHasInstantDeliveryPackages(
  product: Pick<ProductDetail, "deliveryType" | "attributes">,
): boolean {
  const variations = parseProductVariations(product.attributes);
  const isAutoDelivery = product.deliveryType === "auto";
  if (variations.length === 0) return isAutoDelivery;
  return variations.some((v) =>
    variationHasInstantDelivery(v, isAutoDelivery),
  );
}

/** Storefront visibility — hide instant-only products without auto_delivery access. */
export function isProductVisibleForAutoDeliveryAccess(
  product: Pick<ProductDetail, "deliveryType" | "attributes">,
  hasAutoDelivery: boolean,
): boolean {
  if (hasAutoDelivery) return true;
  const variations = parseProductVariations(product.attributes);
  const isAutoDelivery = product.deliveryType === "auto";
  if (variations.length === 0) return !isAutoDelivery;
  return variations.some(
    (v) => !variationHasInstantDelivery(v, isAutoDelivery),
  );
}

export function filterProductsForAutoDeliveryAccess<
  T extends Pick<ProductDetail, "deliveryType" | "attributes">,
>(products: T[], hasAutoDelivery: boolean): T[] {
  if (hasAutoDelivery) return products;
  return products.filter((product) =>
    isProductVisibleForAutoDeliveryAccess(product, false),
  );
}

export function filterPackagesForAutoDeliveryAccess(
  packages: PackageOption[],
  hasAutoDelivery: boolean,
): PackageOption[] {
  if (hasAutoDelivery) return packages;
  return packages.filter((pkg) => !pkg.instantDelivery);
}

/** Storefront PDP — out-of-stock packages are visible only to admin accounts. */
export function filterPackagesForStockVisibility(
  packages: PackageOption[],
  isAdmin: boolean,
): PackageOption[] {
  if (isAdmin) return packages;
  return packages.filter((pkg) => pkg.inStock);
}

export function formatPackageRegionsLabel(
  regions: string[] | undefined,
): string | null {
  if (!regions?.length) return null;
  return regions.join(", ");
}

const STOCK_LOW_THRESHOLD = 100;

export function formatPackageStockLabel(
  pkg: Pick<PackageOption, "inStock" | "availableCount" | "manualStock" | "instantDelivery">,
): string {
  if (!pkg.inStock) return "Out of stock";
  // Use the higher of availableCount or manualStock as the effective display qty.
  // This ensures manually-set stock (e.g. 1000) isn't hidden by a lower
  // per-package inventory counter.
  const displayQty = Math.max(pkg.availableCount, pkg.manualStock ?? 0);
  // Show exact count only when stock is genuinely low (≤ 100).
  const stockLabel =
    displayQty > 0 && displayQty <= STOCK_LOW_THRESHOLD
      ? `Only ${displayQty} left`
      : "In stock";
  return pkg.instantDelivery ? `Instant delivery · ${stockLabel}` : stockLabel;
}

export function buildPackageOptions(
  product: ProductDetail,
  variations: ProductVariation[],
): PackageOption[] {
  const fallbackImage = getProductFallbackImageUrl(product);
  const isAutoDelivery = product.deliveryType === "auto";
  const inventoryByPackage = packageInventoryMap(product);
  const hasPerPackageInventory = inventoryByPackage.size > 0;
  const inventoryAvailable = hasPerPackageInventory
    ? [...inventoryByPackage.values()].reduce((sum, count) => sum + count, 0)
    : Math.max(product.inventoryAvailable ?? 0, product.stock?.available ?? 0);
  const baseInStock = inventoryAvailable > 0;

  if (variations.length > 0) {
    return variations.map((v) => {
      const usesInventory =
        v.stockType === "giftcard" || v.stockType === "api" || isAutoDelivery;
      const packageAvailable = hasPerPackageInventory
        ? (inventoryByPackage.get(v.valueId) ?? 0)
        : usesInventory
          ? inventoryAvailable
          : Math.max(0, v.manualStock ?? 0);
      const inStock =
        v.stockType === "manual"
          ? (v.manualStock ?? 0) > 0 ||
            (hasPerPackageInventory
              ? packageAvailable > 0
              : inventoryAvailable > 0)
          : usesInventory
            ? packageAvailable > 0
            : baseInStock;

      return {
        id: v.id,
        name: v.name,
        price: v.price,
        imageUrl: resolveVariationImageUrl(v.imageUrl, fallbackImage),
        inStock,
        availableCount: inStock ? packageAvailable : 0,
        manualStock: Math.max(0, v.manualStock ?? 0),
        instantDelivery: variationHasInstantDelivery(v, isAutoDelivery),
        regions: resolvePackageRegions(v.regions, product.availableRegions),
      };
    });
  }

  return [
    {
      id: "base",
      name: product.title,
      price: product.pricing.basePrice,
      imageUrl: fallbackImage,
      inStock: isAutoDelivery ? inventoryAvailable > 0 : baseInStock,
      availableCount: isAutoDelivery ? inventoryAvailable : 0,
      manualStock: Math.max(0, product.stock?.available ?? 0),
      instantDelivery: isAutoDelivery,
      regions: resolvePackageRegions(product.availableRegions),
    },
  ];
}

/** Storefront listing/cards — mirrors API productHasPurchasableStock. */
export function isProductInStock(
  product: Pick<
    ProductDetail,
    "stock" | "deliveryType" | "attributes" | "inStock" | "inventoryAvailable"
  >,
): boolean {
  if (product.inStock !== undefined) return product.inStock;

  const isAutoDelivery = product.deliveryType === "auto";
  const inventoryAvailable = Math.max(0, product.inventoryAvailable ?? 0);
  const baseAvailable = Math.max(0, product.stock?.available ?? 0);
  const variations = parseProductVariations(product.attributes);

  if (variations.length > 0) {
    let manualTotal = 0;
    let hasManual = false;
    let hasInventoryVariation = false;
    for (const v of variations) {
      if (v.stockType === "manual") {
        hasManual = true;
        manualTotal += Math.max(0, v.manualStock ?? 0);
        continue;
      }
      if (v.stockType === "giftcard" || v.stockType === "api") {
        hasInventoryVariation = true;
      }
    }
    if (manualTotal > 0) return true;
    if (hasInventoryVariation && inventoryAvailable > 0) return true;
    if (hasManual && !hasInventoryVariation) {
      return Math.max(baseAvailable, inventoryAvailable) > 0;
    }
    return isAutoDelivery ? inventoryAvailable > 0 : baseAvailable > 0;
  }

  return isAutoDelivery ? inventoryAvailable > 0 : baseAvailable > 0;
}
