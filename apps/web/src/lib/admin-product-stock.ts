import { parseStoredVariations } from "@/components/admin/product-variations";
import type { AdminProduct } from "@/lib/api";

/** Sellable units for admin catalog / stock tables. */
export function getAdminProductAvailableStock(product: AdminProduct): number {
  if (typeof product.effectiveAvailable === "number") {
    return Math.max(0, product.effectiveAvailable);
  }

  const variations = parseStoredVariations(product.attributes);
  const baseAvailable = Math.max(0, product.stock?.available ?? 0);
  const inventoryCount = Math.max(0, product.inventoryAvailable ?? 0);
  const isAuto = product.deliveryType === "auto";

  if (variations.length > 0) {
    let manualTotal = 0;
    let hasManual = false;
    let hasInventoryVariation = false;

    for (const variation of variations) {
      if (variation.stockType === "manual") {
        hasManual = true;
        manualTotal += Math.max(0, variation.manualStock ?? 0);
        continue;
      }
      if (variation.stockType === "giftcard" || variation.stockType === "api") {
        hasInventoryVariation = true;
      }
    }

    const inventoryStock = Math.max(baseAvailable, inventoryCount);

    if (hasManual && hasInventoryVariation) {
      return manualTotal + inventoryStock;
    }
    if (hasManual) {
      return manualTotal > 0 ? manualTotal : inventoryStock;
    }
    if (hasInventoryVariation || isAuto) {
      return inventoryStock;
    }
    return baseAvailable;
  }

  return isAuto ? Math.max(baseAvailable, inventoryCount) : baseAvailable;
}
