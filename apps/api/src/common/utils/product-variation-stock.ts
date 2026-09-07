type VariationRow = {
  valueId?: string | number;
  stockType?: string;
  manualStock?: number;
};

type ProductStockSource = {
  deliveryType?: string;
  stock?: { available?: number };
  attributes?: Record<string, unknown>;
};

export type ResolvedLineStock = {
  availableStock: number;
  manualVariation: boolean;
  /** Gift card / API packages — stock comes from inventory items. */
  usesInventory: boolean;
  variationValueId?: string;
};

function findVariation(
  product: ProductStockSource,
  variationValueId?: string,
): VariationRow | undefined {
  if (!variationValueId) return undefined;
  const raw = product.attributes?.variations;
  if (!Array.isArray(raw)) return undefined;
  return raw.find(
    (row) =>
      String((row as VariationRow).valueId ?? '') === variationValueId,
  ) as VariationRow | undefined;
}

function usesInventoryStockType(stockType?: string): boolean {
  return stockType === 'giftcard' || stockType === 'api';
}

export function variationHasInstantDelivery(
  variation: VariationRow,
  isAutoDelivery: boolean,
): boolean {
  const stockType = variation.stockType ?? 'manual';
  if (stockType === 'manual') return false;
  return usesInventoryStockType(stockType) || isAutoDelivery;
}

/** True when the product has at least one instant-delivery package. */
export function productHasInstantDeliveryPackages(
  product: ProductStockSource,
): boolean {
  const isAuto = product.deliveryType === 'auto';
  const raw = product.attributes?.variations;
  if (!Array.isArray(raw) || raw.length === 0) return isAuto;
  return raw.some((row) =>
    variationHasInstantDelivery(row as VariationRow, isAuto),
  );
}

/** Cart/checkout lines that auto-deliver codes require the auto_delivery role. */
export function lineRequiresAutoDeliveryPermission(
  product: ProductStockSource,
  variationValueId?: string,
): boolean {
  const stock = resolveLineStock(product, variationValueId);
  return stock.usesInventory && !stock.manualVariation;
}

/** True when a package uses inventory_items (stock management / auto codes). */
export function variationUsesInventoryPackage(
  variation: VariationRow,
): boolean {
  const stockType = variation.stockType ?? 'manual';
  if (stockType === 'manual') return false;
  return usesInventoryStockType(stockType);
}

/** Gift card / API package value ids used for per-package inventory. */
export function inventoryPackageValueIds(
  product: ProductStockSource,
): string[] {
  const raw = product.attributes?.variations;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const variation = row as VariationRow;
      if (!variationUsesInventoryPackage(variation)) return null;
      const valueId = String(variation.valueId ?? '').trim();
      return valueId || null;
    })
    .filter((valueId): valueId is string => Boolean(valueId));
}

/** True when deliverable codes from inventory_items drive sellable stock. */
export function productUsesInventoryItems(
  product: ProductStockSource,
): boolean {
  if (product.deliveryType === 'auto') return true;
  const raw = product.attributes?.variations;
  if (!Array.isArray(raw)) return false;
  return raw.some((row) =>
    usesInventoryStockType((row as VariationRow).stockType),
  );
}

function productLevelInventoryStock(
  baseAvailable: number,
  inventoryCount: number,
): number {
  return Math.max(baseAvailable, inventoryCount);
}

export function resolveLineStock(
  product: ProductStockSource,
  variationValueId?: string,
): ResolvedLineStock {
  const baseAvailable = Math.max(0, product.stock?.available ?? 0);
  const normalizedVariationId = variationValueId?.trim() || undefined;
  const autoDelivery = product.deliveryType === 'auto';

  if (!normalizedVariationId) {
    return {
      availableStock: autoDelivery ? 0 : baseAvailable,
      manualVariation: false,
      usesInventory: autoDelivery,
    };
  }

  const variation = findVariation(product, normalizedVariationId);
  if (!variation) {
    return {
      availableStock: autoDelivery ? 0 : baseAvailable,
      manualVariation: false,
      usesInventory: autoDelivery,
      variationValueId: normalizedVariationId,
    };
  }

  if (variation.stockType === 'manual') {
    return {
      availableStock: Math.max(0, Number(variation.manualStock ?? 0)),
      manualVariation: true,
      usesInventory: false,
      variationValueId: normalizedVariationId,
    };
  }

  if (usesInventoryStockType(variation.stockType) || autoDelivery) {
    return {
      availableStock: 0,
      manualVariation: false,
      usesInventory: true,
      variationValueId: normalizedVariationId,
    };
  }

  return {
    availableStock: baseAvailable,
    manualVariation: false,
    usesInventory: false,
    variationValueId: normalizedVariationId,
  };
}

/** True when at least one package/line can be purchased. */
export function productHasPurchasableStock(
  product: ProductStockSource,
  inventoryAvailable = 0,
): boolean {
  const raw = product.attributes?.variations;
  const isAuto = product.deliveryType === 'auto';
  const baseAvailable = Math.max(0, product.stock?.available ?? 0);
  const inventoryCount = Math.max(0, inventoryAvailable);

  if (Array.isArray(raw) && raw.length > 0) {
    let manualTotal = 0;
    let hasManual = false;
    let hasInventoryVariation = false;
    for (const row of raw) {
      const variation = row as VariationRow;
      const stockType = variation.stockType ?? 'manual';
      if (stockType === 'manual') {
        hasManual = true;
        manualTotal += Math.max(0, Number(variation.manualStock ?? 0));
        continue;
      }
      if (usesInventoryStockType(stockType)) {
        hasInventoryVariation = true;
      }
    }
    if (manualTotal > 0) return true;
    if (hasInventoryVariation && inventoryCount > 0) return true;
    if (hasManual && !hasInventoryVariation) {
      return productLevelInventoryStock(baseAvailable, inventoryCount) > 0;
    }
    return isAuto ? inventoryCount > 0 : baseAvailable > 0;
  }

  return isAuto ? inventoryCount > 0 : baseAvailable > 0;
}

/** Total sellable units for admin catalog / stock views. */
export function resolveProductAvailableStock(
  product: ProductStockSource,
  inventoryAvailable = 0,
): number {
  const raw = product.attributes?.variations;
  const baseAvailable = Math.max(0, product.stock?.available ?? 0);
  const inventoryCount = Math.max(0, inventoryAvailable);
  const isAuto = product.deliveryType === 'auto';

  if (Array.isArray(raw) && raw.length > 0) {
    let manualTotal = 0;
    let hasManual = false;
    let hasInventoryVariation = false;

    for (const row of raw) {
      const variation = row as VariationRow;
      const stockType = variation.stockType ?? 'manual';
      if (stockType === 'manual') {
        hasManual = true;
        manualTotal += Math.max(0, Number(variation.manualStock ?? 0));
        continue;
      }
      if (usesInventoryStockType(stockType)) {
        hasInventoryVariation = true;
      }
    }

    const inventoryStock = productLevelInventoryStock(
      baseAvailable,
      inventoryCount,
    );

    if (hasManual && hasInventoryVariation) {
      return manualTotal + inventoryStock;
    }
    if (hasManual) {
      // Manual packages with no manualStock still sell when codes were added.
      return manualTotal > 0 ? manualTotal : inventoryStock;
    }
    if (hasInventoryVariation || isAuto) {
      return inventoryStock;
    }
    return baseAvailable;
  }

  return isAuto ? Math.max(baseAvailable, inventoryCount) : baseAvailable;
}
