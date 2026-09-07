"use client";

import Link from "next/link";
import {
  CheckoutItemExtras,
  CheckoutItemHeader,
} from "@/components/checkout/CheckoutItemDetails";
import { PriceText } from "@/components/ui/PriceText";
import {
  AdminOrderListCard,
  AdminOrderStatField,
  AdminOrderStatsGrid,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import {
  CartIcon,
  CreditCardIcon,
  ReceiptIcon,
  TagIcon,
  TrashIcon,
  ZapIcon,
} from "@/components/admin/icons";
import {
  type CartView as CartData,
} from "@/lib/api";
import { productPath } from "@/lib/seo";

type Props = {
  cart: CartData;
  currency: string;
  busy: boolean;
  couponCode: string;
  voucherCode: string;
  msg: string | null;
  msgIsError: boolean;
  onCouponCodeChange: (value: string) => void;
  onVoucherCodeChange: (value: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  onApplyVoucher: () => void;
  onRemoveVoucher: () => void;
  onUpdateQuantity: (
    productId: string,
    quantity: number,
    variationValueId?: string,
  ) => void;
  onRemoveItem: (productId: string, variationValueId?: string) => void;
};

export function CartView({
  cart,
  currency,
  busy,
  couponCode,
  voucherCode,
  msg,
  msgIsError,
  onCouponCodeChange,
  onVoucherCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  onApplyVoucher,
  onRemoveVoucher,
  onUpdateQuantity,
  onRemoveItem,
}: Props) {
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <div className="cart-page space-y-5">
      {msg ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msgIsError
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
          role="status"
        >
          {msg}
        </div>
      ) : null}

      <AdminOrderTwoColumnLayout
        main={
          <>
            <AdminOrderListCard
              className="hidden sm:block"
              icon={<ReceiptIcon className="h-4 w-4" />}
              title="Cart overview"
              subtitle={`${itemCount} ${itemCount === 1 ? "item" : "items"} ready for checkout`}
            >
              <AdminOrderStatsGrid className="cart-overview-stats-grid">
                <AdminOrderStatField
                  icon={<CartIcon className="h-4 w-4" />}
                  label="Products"
                  value={cart.items.length.toLocaleString()}
                  meta="Unique line items"
                />
                <AdminOrderStatField
                  icon={<TagIcon className="h-4 w-4" />}
                  label="Quantity"
                  value={itemCount.toLocaleString()}
                  meta="Total units in cart"
                />
                <AdminOrderStatField
                  icon={<ZapIcon className="h-4 w-4" />}
                  label="Total"
                  value={<PriceText amount={cart.total} currency={currency} />}
                  meta="Estimated checkout amount"
                />
              </AdminOrderStatsGrid>
            </AdminOrderListCard>

            <AdminOrderListCard
              icon={<CartIcon className="h-4 w-4" />}
              title="Cart items"
              subtitle="Review products, quantities, and delivery details"
            >
              <div className="admin-product-form-basic-fields space-y-4">
                {cart.items.map((it) => (
                  <article
                    key={`${it.productId}::${it.variationValueId ?? ""}`}
                    className="cart-item rounded-xl border border-border/40 bg-muted/20"
                  >
                    <div className="cart-item-inner">
                      <div className="checkout-item-intro">
                        <div className="checkout-item-head cart-item-head">
                          <span className="checkout-item-thumb cart-item-thumb">
                            {it.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.thumbnail} alt={it.title} />
                            ) : (
                              <span className="checkout-item-thumb-fallback">
                                No image
                              </span>
                            )}
                          </span>

                          <CheckoutItemHeader
                            title={
                              <Link
                                href={productPath(it.slug)}
                                className="checkout-item-title-link hover:text-brand"
                              >
                                {it.title}
                              </Link>
                            }
                          />
                        </div>
                      </div>

                      <div className="cart-item-body">
                        <CheckoutItemExtras
                          customerInputs={it.customerInputs}
                          packageName={it.packageName}
                          unitPrice={it.unitPrice}
                          lineTotal={it.lineTotal}
                          currency={currency}
                        />

                        <div className="checkout-item-actions">
                          <div className="checkout-qty">
                            <button
                              type="button"
                              disabled={busy || it.quantity <= 1}
                              onClick={() =>
                                onUpdateQuantity(
                                  it.productId,
                                  Math.max(0, it.quantity - 1),
                                  it.variationValueId,
                                )
                              }
                              className="checkout-qty-btn"
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="checkout-qty-val">{it.quantity}</span>
                            <button
                              type="button"
                              disabled={busy || it.quantity >= it.availableStock}
                              onClick={() =>
                                onUpdateQuantity(
                                  it.productId,
                                  it.quantity + 1,
                                  it.variationValueId,
                                )
                              }
                              className="checkout-qty-btn"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              onRemoveItem(it.productId, it.variationValueId)
                            }
                            className="checkout-item-remove"
                            aria-label={`Remove ${it.title}`}
                          >
                            <TrashIcon className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </AdminOrderListCard>
          </>
        }
        sidebar={
          <>
            <div className="checkout-summary-card checkout-summary-card--order">
              <header className="checkout-summary-head">
                <span className="checkout-summary-icon" aria-hidden>
                  <ReceiptIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="checkout-summary-title">Order summary</h2>
                  <p className="checkout-summary-sub">
                    {cart.items.length}{" "}
                    {cart.items.length === 1 ? "product" : "products"} in cart
                  </p>
                </div>
                <span className="checkout-summary-badge" aria-hidden>
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </header>

              <div className="checkout-summary-body">
                <div className="checkout-totals">
                  <div className="checkout-total-row">
                    <span>
                      Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
                    </span>
                    <span>
                      <PriceText amount={cart.subtotal} currency={currency} />
                    </span>
                  </div>
                  {cart.coupon?.valid ? (
                    <div className="checkout-total-row checkout-total-row--discount">
                      <span>{cart.coupon.code}</span>
                      <span>
                        −
                        <PriceText
                          amount={cart.coupon.discount}
                          currency={currency}
                        />
                      </span>
                    </div>
                  ) : null}
                  {cart.voucher?.valid ? (
                    <div className="checkout-total-row checkout-total-row--discount">
                      <span>{cart.voucher.code}</span>
                      <span>
                        −
                        <PriceText
                          amount={cart.voucher.applied}
                          currency={currency}
                        />
                      </span>
                    </div>
                  ) : null}
                  <div className="checkout-total-row">
                    <span>Delivery</span>
                    <span className="checkout-delivery">Instant · Free</span>
                  </div>
                  <div className="checkout-total-row checkout-total-row--grand">
                    <span>Total</span>
                    <span>
                      <PriceText amount={cart.total} currency={currency} />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/*
              Discounts uses two nested boxes:
              1) Outer card — AdminOrderListCard / cart-discounts-card (glass shell; gap vs Order summary is unchanged)
              2) Inner inset box — .admin-order-view-pro-section-panel (bordered area; title + code inputs live here)
              Visible title is cart-discounts-box-head inside the inner box.
            */}
            <AdminOrderListCard
              icon={<TagIcon className="h-4 w-4" />}
              title="Discounts"
              subtitle="Add discount codes"
              className="cart-discounts-card admin-product-form-section"
              hideHeader
            >
              {/* Inner box — top: Discounts title; below: Coupon / voucher fields */}
              <header className="cart-discounts-box-head">
                <span className="dashboard-pro-section-icon" aria-hidden>
                  <TagIcon className="h-4 w-4" />
                </span>
                <div className="admin-order-view-section-copy min-w-0">
                  <h2 className="dashboard-pro-section-title">Discounts</h2>
                  <p className="dashboard-pro-section-sub">Add discount codes</p>
                </div>
              </header>
              <div className="cart-discounts-box-fields">
                <div className="cart-discounts-field">
                  {cart.coupon ? (
                    <div className="cart-promo-applied">
                      <span
                        className={
                          cart.coupon.valid ? "text-foreground" : "text-danger"
                        }
                      >
                        {cart.coupon.code}
                        {!cart.coupon.valid && cart.coupon.reason
                          ? ` — ${cart.coupon.reason}`
                          : ""}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onRemoveCoupon}
                        className="cart-item-remove"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="cart-promo-row">
                      <input
                        id="cart-coupon"
                        value={couponCode}
                        onChange={(e) => onCouponCodeChange(e.target.value)}
                        placeholder="Coupon code"
                        aria-label="Coupon code"
                        className="cart-discounts-input"
                      />
                      <button
                        type="button"
                        disabled={busy || !couponCode.trim()}
                        onClick={onApplyCoupon}
                        className="cart-promo-apply-btn disabled:opacity-50"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>

                <div className="cart-discounts-field">
                  {cart.voucher ? (
                    <div className="cart-promo-applied">
                      <span
                        className={
                          cart.voucher.valid ? "text-foreground" : "text-danger"
                        }
                      >
                        {cart.voucher.code}
                        {!cart.voucher.valid && cart.voucher.reason
                          ? ` — ${cart.voucher.reason}`
                          : ""}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onRemoveVoucher}
                        className="cart-item-remove"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="cart-promo-row">
                      <input
                        id="cart-voucher"
                        value={voucherCode}
                        onChange={(e) => onVoucherCodeChange(e.target.value)}
                        placeholder="Voucher code"
                        aria-label="Voucher code"
                        className="cart-discounts-input"
                      />
                      <button
                        type="button"
                        disabled={busy || !voucherCode.trim()}
                        onClick={onApplyVoucher}
                        className="cart-promo-apply-btn disabled:opacity-50"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </AdminOrderListCard>

            <AdminOrderListCard
              icon={<CreditCardIcon className="h-4 w-4" />}
              title="Checkout"
              subtitle="Choose payment and continue"
              className="cart-checkout-card admin-product-form-section"
              hideHeader
            >
              <header className="cart-discounts-box-head">
                <span className="dashboard-pro-section-icon" aria-hidden>
                  <CreditCardIcon className="h-4 w-4" />
                </span>
                <div className="admin-order-view-section-copy min-w-0">
                  <h2 className="dashboard-pro-section-title">Checkout</h2>
                  <p className="dashboard-pro-section-sub">
                    Choose payment and continue
                  </p>
                </div>
              </header>
              <div className="cart-discounts-box-fields">
                <Link
                  href="/checkout"
                  className="dashboard-pro-btn block w-full text-center"
                >
                  Proceed to checkout
                </Link>
              </div>
            </AdminOrderListCard>
          </>
        }
      />
    </div>
  );
}

export function CartEmptyView() {
  return (
    <div className="cart-page space-y-5">
      <AdminOrderListCard
        icon={<CartIcon className="h-4 w-4" />}
        title="Cart items"
        subtitle="Your shopping cart is empty"
      >
        <div className="dashboard-pro-empty py-8">
          <span className="dashboard-pro-empty-icon" aria-hidden>
            <CartIcon className="h-6 w-6" />
          </span>
          <p className="text-sm font-medium text-foreground">
            Your cart is empty
          </p>
          <p className="mt-1 text-xs text-subtle">
            Browse products and add gift cards or digital items to get started.
          </p>
          <Link href="/products" className="dashboard-pro-btn mt-4">
            Browse products
          </Link>
        </div>
      </AdminOrderListCard>
    </div>
  );
}
