import {
  parseStoredVariations,
  type ProductVariation,
} from "@/components/admin/product-variations";
import type { AdminProduct } from "@/lib/api";

export const UNASSIGNED_INVENTORY_SCOPE = "__unassigned__";

/** Product uses auto delivery (license/code stock from inventory_items). */
export function isAutoDeliveryStockProduct(
  product: Pick<AdminProduct, "deliveryType">,
): boolean {
  return product.deliveryType === "auto";
}

/** Packages that use inventory_items (gift card codes / API auto stock — not manual delivery). */
export function productVariationUsesInventoryPackage(
  variation: Pick<ProductVariation, "stockType">,
): boolean {
  if (variation.stockType === "manual") return false;
  return variation.stockType === "giftcard" || variation.stockType === "api";
}

export function inventoryManagedPackages(
  product: {
    attributes?: Record<string, unknown>;
    deliveryType?: string;
  },
): ProductVariation[] {
  const variations = parseStoredVariations(product.attributes);
  return variations.filter((variation) =>
    productVariationUsesInventoryPackage(variation),
  );
}

/** Products shown in manual gift card stock picker (auto-delivery + inventory codes). */
export function productUsesInventoryCatalog(
  product: Pick<AdminProduct, "attributes" | "deliveryType">,
): boolean {
  if (!isAutoDeliveryStockProduct(product)) return false;

  const managed = inventoryManagedPackages(product);
  if (managed.length > 0) return true;

  // Flat auto product (no variations) can hold product-level inventory codes.
  const variations = parseStoredVariations(product.attributes);
  return variations.length === 0;
}

/** Inventory codes only — never manualStock or legacy product.stock.available. */
function resolveInventoryCodeCount(
  stockDetail: StockDetailSnapshot | undefined,
  product: Pick<AdminProduct, "inventoryAvailable">,
  variationValueId?: string,
): number {
  if (variationValueId) {
    return resolvePackageAvailableCount(stockDetail?.packages, variationValueId);
  }
  return Math.max(
    0,
    stockDetail?.available ?? product.inventoryAvailable ?? 0,
  );
}

export type CatalogInventoryLine = {
  key: string;
  productId: string;
  productTitle: string;
  variationValueId?: string;
  label: string;
  packageLabel: string | null;
  inOrder: boolean;
  availableCount: number;
  hasStock: boolean;
};

/** All product/package rows that can be picked from stock management. */
export function buildCatalogInventoryLines(
  products: AdminProduct[],
  orderLineKeys: Set<string> = new Set(),
): CatalogInventoryLine[] {
  const lines: CatalogInventoryLine[] = [];

  for (const product of products) {
    if (!productUsesInventoryCatalog(product)) continue;

    const productId = product._id;
    const packages = inventoryManagedPackages(product);

    if (packages.length === 0) {
      const availableCount = Math.max(0, product.inventoryAvailable ?? 0);
      lines.push({
        key: `${productId}::`,
        productId,
        productTitle: product.title,
        variationValueId: undefined,
        label: product.title,
        packageLabel: null,
        inOrder: catalogLineInOrder(productId, undefined, orderLineKeys),
        availableCount,
        hasStock: availableCount > 0,
      });
      continue;
    }

    for (const pkg of packages) {
      lines.push({
        key: `${productId}::${pkg.valueId}`,
        productId,
        productTitle: product.title,
        variationValueId: pkg.valueId,
        label: `${product.title} (${pkg.name})`,
        packageLabel: pkg.name,
        inOrder: catalogLineInOrder(productId, pkg.valueId, orderLineKeys),
        availableCount: 0,
        hasStock: false,
      });
    }
  }

  return lines.sort((a, b) => {
    if (a.inOrder !== b.inOrder) return a.inOrder ? -1 : 1;
    if (a.hasStock !== b.hasStock) return a.hasStock ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

function variationValueIdMatches(a: string, b: string): boolean {
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

export function catalogLineMatchesSearch(
  line: Pick<
    CatalogInventoryLine,
    "label" | "productTitle" | "packageLabel"
  >,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    line.label.toLowerCase().includes(q) ||
    line.productTitle.toLowerCase().includes(q) ||
    (line.packageLabel?.toLowerCase().includes(q) ?? false)
  );
}

/** Default list: stocked packages only. Search never reveals empty inventory. */
export function filterCatalogInventoryLines(
  lines: CatalogInventoryLine[],
  searchQuery: string,
): CatalogInventoryLine[] {
  return lines.filter((line) => {
    if (!catalogLineMatchesSearch(line, searchQuery)) return false;
    return line.hasStock || line.inOrder;
  });
}

export function countHiddenCatalogLines(
  lines: CatalogInventoryLine[],
): number {
  return lines.filter((line) => !line.hasStock && !line.inOrder).length;
}

function catalogLineInOrder(
  productId: string,
  variationValueId: string | undefined,
  orderLineKeys: Set<string>,
): boolean {
  if (orderLineKeys.size === 0) return false;

  const normalized = variationValueId?.trim() ?? "";
  if (orderLineKeys.has(`${productId}::${normalized}`)) return true;

  for (const key of orderLineKeys) {
    const sep = key.indexOf("::");
    if (sep < 0) continue;
    const orderProductId = key.slice(0, sep);
    const orderVariationId = key.slice(sep + 2);
    if (orderProductId !== productId || !orderVariationId) continue;
    if (normalized && variationValueIdMatches(orderVariationId, normalized)) {
      return true;
    }
  }

  return false;
}

export function resolvePackageAvailableCount(
  packages: Array<{ valueId: string; available: number }> | undefined,
  variationValueId?: string,
): number {
  if (!packages?.length || !variationValueId) return 0;
  const match = packages.find((pkg) =>
    variationValueIdMatches(pkg.valueId, variationValueId),
  );
  return Math.max(0, match?.available ?? 0);
}

export type PackageStockCounts = {
  available?: number;
  reserved?: number;
  sold?: number;
};

/** Total inventory units across available, reserved, and sold. */
export function packageInventoryTotal(stock?: PackageStockCounts | null): number {
  if (!stock) return 0;
  return (
    Math.max(0, stock.available ?? 0) +
    Math.max(0, stock.reserved ?? 0) +
    Math.max(0, stock.sold ?? 0)
  );
}

export function packageHasInventory(stock?: PackageStockCounts | null): boolean {
  return packageInventoryTotal(stock) > 0;
}

/** Amount label from inventory package name (e.g. "iTunes Gift Card 2$" → "2$"). */
export function formatInventoryPackageAmount(packageName: string): string {
  const trimmed = packageName.trim();
  if (!trimmed) return "";

  const lastToken = trimmed.split(/\s+/).pop() ?? "";
  if (/^(\$?\d+(?:\.\d+)?\$?|\d+(?:\.\d+)?\$)$/.test(lastToken)) {
    return lastToken;
  }

  const trailing = trimmed.match(
    /(\$?\d+(?:\.\d+)?\$?|\d+(?:\.\d+)?\s*(?:USD|usd))\s*$/i,
  );
  if (trailing?.[1]) {
    return trailing[1].replace(/\s+/g, "").replace(/usd/i, "");
  }

  if (/^\d+(?:\.\d+)?$/.test(lastToken)) {
    return lastToken;
  }

  return trimmed;
}

/** Numeric gift-card amount digits (e.g. "10$" → "10"). */
export function resolveGiftCardAmountNumber(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "";

  const formatted = formatInventoryPackageAmount(trimmed);
  const fromFormatted = extractNumericGiftCardAmount(formatted);
  if (fromFormatted) return fromFormatted;

  return extractNumericGiftCardAmount(trimmed);
}

/** Gift-card amount for manual delivery fields (e.g. "test 2$" → "2$"). */
export function resolveGiftCardAmountDisplay(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "";

  const trailingFormat = trimmed.match(/^(\d+(?:\.\d+)?)\$$/);
  if (trailingFormat) return trimmed;

  const leadingFormat = trimmed.match(/^\$(\d+(?:\.\d+)?)$/);
  if (leadingFormat?.[1]) return `${leadingFormat[1]}$`;

  const numeric = resolveGiftCardAmountNumber(trimmed);
  return numeric ? `${numeric}$` : "";
}

function extractNumericGiftCardAmount(text: string): string {
  const value = text.trim();
  if (!value) return "";

  const currencyMatch = value.match(
    /\$(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\$|(\d+(?:\.\d+)?)\s*(?:usd|dollar|dollars)\b/i,
  );
  if (currencyMatch) {
    return currencyMatch[1] ?? currencyMatch[2] ?? currencyMatch[3] ?? "";
  }

  if (/^\d+(?:\.\d+)?$/.test(value)) return value;

  const anywhere = value.match(/\b(\d+(?:\.\d+)?)\b/);
  return anywhere?.[1] ?? "";
}

export type ManualStockCatalogPackage = {
  valueId: string;
  name: string;
  availableCount: number;
  hasStock: boolean;
  inOrder: boolean;
};

export type ManualStockCatalogProduct = {
  productId: string;
  product: AdminProduct;
  totalAvailable: number;
  hasStock: boolean;
  inOrder: boolean;
  packages: ManualStockCatalogPackage[];
};

type StockDetailSnapshot = {
  available?: number;
  packages?: Array<{ valueId: string; available: number }>;
};

export function buildManualStockCatalog(
  products: AdminProduct[],
  orderLineKeys: Set<string>,
  stockByProductId: Map<string, StockDetailSnapshot>,
): ManualStockCatalogProduct[] {
  const catalog: ManualStockCatalogProduct[] = [];

  for (const product of products) {
    if (!productUsesInventoryCatalog(product)) continue;

    const productId = product._id;
    const stockDetail = stockByProductId.get(productId);
    const managedPackages = inventoryManagedPackages(product);
    const packageRows: ManualStockCatalogPackage[] = [];

    if (managedPackages.length === 0) {
      const availableCount = resolveInventoryCodeCount(stockDetail, product);
      catalog.push({
        productId,
        product,
        totalAvailable: availableCount,
        hasStock: availableCount > 0,
        inOrder: catalogLineInOrder(productId, undefined, orderLineKeys),
        packages: [],
      });
      continue;
    }

    for (const pkg of managedPackages) {
      const availableCount = resolveInventoryCodeCount(
        stockDetail,
        product,
        pkg.valueId,
      );
      packageRows.push({
        valueId: pkg.valueId,
        name: pkg.name,
        availableCount,
        hasStock: availableCount > 0,
        inOrder: catalogLineInOrder(productId, pkg.valueId, orderLineKeys),
      });
    }

    const totalAvailable = packageRows.reduce(
      (sum, row) => sum + row.availableCount,
      0,
    );

    catalog.push({
      productId,
      product,
      totalAvailable,
      hasStock: packageRows.some((row) => row.hasStock),
      inOrder: packageRows.some((row) => row.inOrder),
      packages: packageRows,
    });
  }

  return catalog.sort((a, b) => {
    if (a.hasStock !== b.hasStock) return a.hasStock ? -1 : 1;
    if (a.inOrder !== b.inOrder) return a.inOrder ? -1 : 1;
    return a.product.title.localeCompare(b.product.title);
  });
}

function sortManualStockCatalog(
  catalog: ManualStockCatalogProduct[],
): ManualStockCatalogProduct[] {
  return [...catalog].sort((a, b) => {
    if (a.hasStock !== b.hasStock) return a.hasStock ? -1 : 1;
    if (a.inOrder !== b.inOrder) return a.inOrder ? -1 : 1;
    return a.product.title.localeCompare(b.product.title);
  });
}

/** Re-apply order-line badges without reloading stock from the API. */
export function applyManualStockOrderFlags(
  catalog: ManualStockCatalogProduct[],
  orderLineKeys: Set<string>,
): ManualStockCatalogProduct[] {
  return sortManualStockCatalog(
    catalog.map((entry) => {
      const packages = entry.packages.map((pkg) => ({
        ...pkg,
        inOrder: catalogLineInOrder(entry.productId, pkg.valueId, orderLineKeys),
      }));
      return {
        ...entry,
        packages,
        inOrder:
          packages.some((pkg) => pkg.inOrder) ||
          catalogLineInOrder(entry.productId, undefined, orderLineKeys),
      };
    }),
  );
}

export function manualStockProductMatchesSearch(
  entry: ManualStockCatalogProduct,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { product } = entry;
  return (
    product.title.toLowerCase().includes(q) ||
    product.slug.toLowerCase().includes(q) ||
    (product.sku?.toLowerCase().includes(q) ?? false) ||
    entry.packages.some((pkg) => pkg.name.toLowerCase().includes(q))
  );
}

export function filterManualStockProducts(
  catalog: ManualStockCatalogProduct[],
  searchQuery: string,
): ManualStockCatalogProduct[] {
  return catalog.filter((entry) => {
    if (!manualStockProductMatchesSearch(entry, searchQuery)) return false;
    return entry.hasStock || entry.inOrder;
  });
}

export function filterManualStockPackages(
  packages: ManualStockCatalogPackage[],
  searchQuery: string,
): ManualStockCatalogPackage[] {
  const q = searchQuery.trim().toLowerCase();
  return packages.filter((pkg) => {
    if (q && !pkg.name.toLowerCase().includes(q)) return false;
    return pkg.hasStock || pkg.inOrder;
  });
}

export function countHiddenManualStockProducts(
  catalog: ManualStockCatalogProduct[],
): number {
  return catalog.filter((entry) => !entry.hasStock && !entry.inOrder).length;
}
