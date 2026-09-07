"use client";

import { LayersIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";

type Props = {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
};

export function ProductDetailQuantity({
  quantity,
  onDecrease,
  onIncrease,
}: Props) {
  return (
    <div className="customer-panel product-pdp-quantity-wrap min-w-0">
      <ProductFormOrderCard
        className="admin-product-form-section product-pdp-quantity"
        icon={<LayersIcon className="h-4 w-4" strokeWidth={2} aria-hidden />}
        title="Quantity"
        showBody={false}
        action={
          <div className="product-pdp-quantity-inline">
            <div
              className="checkout-qty product-pdp-quantity-controls"
              role="group"
              aria-label="Quantity"
            >
              <button
                type="button"
                disabled={quantity <= 1}
                onClick={onDecrease}
                className="checkout-qty-btn"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="checkout-qty-val" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                onClick={onIncrease}
                className="checkout-qty-btn"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>
        }
      >
        {null}
      </ProductFormOrderCard>
    </div>
  );
}
