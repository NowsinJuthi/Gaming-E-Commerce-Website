"use client";

import { PriceText } from "@/components/ui/PriceText";
import { ReceiptIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { RegionIcon } from "@/components/ui/RegionIcon";

type Props = {
  packageName?: string;
  regionName?: string;
  subtotal: number;
  currency: string;
};

export function ProductDetailOrderSummary({
  packageName,
  regionName,
  subtotal,
  currency,
}: Props) {
  return (
    <div className="customer-panel min-w-0">
      <ProductFormOrderCard
        className="admin-product-form-section product-pdp-order-summary"
        icon={<ReceiptIcon className="h-4 w-4" strokeWidth={2} aria-hidden />}
        title="Order summary"
      >
        <dl className="space-y-2">
          <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
            <dt>Package</dt>
            <dd className="min-w-0 text-right">
              {packageName ?? "—"}
            </dd>
          </div>
          {regionName ? (
            <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
              <dt>Region</dt>
              <dd className="inline-flex min-w-0 items-center justify-end gap-1.5 text-right">
                <RegionIcon region={regionName} className="product-pdp-region-icon" />
                <span>{regionName}</span>
              </dd>
            </div>
          ) : null}
          <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
            <dt>Subtotal</dt>
            <dd>
              <PriceText amount={subtotal} currency={currency} />
            </dd>
          </div>
          <div className="admin-order-view-detail-row admin-order-view-detail-row--inline font-semibold text-foreground">
            <dt>Total</dt>
            <dd>
              <PriceText amount={subtotal} currency={currency} />
            </dd>
          </div>
        </dl>
      </ProductFormOrderCard>
    </div>
  );
}
