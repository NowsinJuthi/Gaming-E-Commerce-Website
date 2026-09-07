"use client";

import Link from "next/link";
import {
  CheckoutItemExtras,
  CheckoutItemHeader,
} from "@/components/checkout/CheckoutItemDetails";
import { PriceText } from "@/components/ui/PriceText";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CartIcon,
  ChatIcon,
  CheckIcon,
  CreditCardIcon,
  InfoIcon,
  LockIcon,
  MailIcon,
  ReceiptIcon,
  ShieldIcon,
  TrashIcon,
  UserIcon,
  WalletIcon,
  ZapIcon,
} from "@/components/admin/icons";
import { ActionButton } from "@/components/ui/ActionButton";
import { AdminOrderListCard } from "@/components/admin/admin-order-page-shell";
import { productInputCls, productLabelCls } from "@/components/admin/product-form";
import {
  removeCartItem,
  updateCartItem,
  type CartView,
  type CustomerPanelConfig,
  type PaymentMethodValue,
  type UserProfile,
  type Wallet,
} from "@/lib/api";
import {
  resolveCheckoutContact,
  saveCheckoutContact,
  type CheckoutContact,
} from "@/lib/checkout-contact";
import { toast } from "@/stores/toast-store";
import {
  checkoutMethodsFromConfig,
  isPaymentMethodEnabled,
  orderedCheckoutPaymentOptions,
  paymentMethodOrderFromConfig,
} from "@/lib/checkout-payment-methods";

export type { CheckoutContact };

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function SecureCheckoutCard() {
  return (
    <AdminOrderListCard
      icon={<ShieldIcon className="h-4 w-4" />}
      title="Secure checkout"
      subtitle="Your order is protected"
      className="checkout-secure-card admin-product-form-section"
    >
      <dl className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>Buyer protection</dt>
        <dd className="admin-product-form-basic-fields">
          <ul className="checkout-secure-list">
            <li>
              <CheckIcon className="h-4 w-4" aria-hidden />
              Secure wallet payment
            </li>
            <li>
              <MailIcon className="h-4 w-4" aria-hidden />
              Codes sent to your email instantly
            </li>
            <li>
              <LockIcon className="h-4 w-4" aria-hidden />
              Digital delivery — no refunds on delivered codes
            </li>
          </ul>
        </dd>
      </dl>
    </AdminOrderListCard>
  );
}

type Props = {
  cart: CartView;
  config: CustomerPanelConfig | null;
  profile: UserProfile | null;
  wallet: Wallet | null;
  currency: string;
  paymentMethod: PaymentMethodValue;
  onPaymentMethodChange: (method: PaymentMethodValue) => void;
  orderNote: string;
  onOrderNoteChange: (note: string) => void;
  onCartChange: (cart: CartView) => void;
  onPlaceOrder: (contact: CheckoutContact) => void | Promise<void>;
  placing: boolean;
  message: string | null;
};

export function CheckoutView({
  cart,
  config,
  profile,
  wallet,
  currency,
  paymentMethod,
  onPaymentMethodChange,
  orderNote,
  onOrderNoteChange,
  onCartChange,
  onPlaceOrder,
  placing,
  message,
}: Props) {
  const [busy, setBusy] = useState(false);
  const initialContact = useMemo(
    () => resolveCheckoutContact(profile),
    [profile],
  );
  const [fullName, setFullName] = useState(initialContact.fullName);
  const [mobile, setMobile] = useState(initialContact.mobile);
  const [email, setEmail] = useState(initialContact.email);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactTouched, setContactTouched] = useState(false);
  const contactSectionRef = useRef<HTMLDivElement>(null);
  const submitLockRef = useRef(false);

  useEffect(() => {
    saveCheckoutContact({ fullName, mobile, email });
  }, [fullName, mobile, email]);

  const contactValid = useMemo(
    () =>
      fullName.trim().length > 0 &&
      mobile.trim().length > 0 &&
      email.trim().length > 0 &&
      isValidEmail(email),
    [fullName, mobile, email],
  );

  const itemCount = useMemo(
    () => cart.items.reduce((sum, it) => sum + it.quantity, 0),
    [cart.items],
  );

  const walletBalance = wallet?.balance ?? 0;
  const walletCurrency = wallet?.currency ?? currency;
  const balanceAfterPay = Math.max(0, walletBalance - cart.total);
  const paymentMethods = useMemo(() => checkoutMethodsFromConfig(config), [config]);
  const paymentMethodOrder = useMemo(() => paymentMethodOrderFromConfig(config), [config]);
  const visiblePaymentOptions = useMemo(
    () => orderedCheckoutPaymentOptions(paymentMethods, paymentMethodOrder),
    [paymentMethods, paymentMethodOrder],
  );
  const hasPaymentMethods = visiblePaymentOptions.length > 0;
  const paymentMethodEnabled = isPaymentMethodEnabled(
    paymentMethod,
    paymentMethods,
  );
  const insufficientWallet =
    paymentMethod === "wallet" && walletBalance < cart.total;
  const canPlaceOrder =
    hasPaymentMethods && paymentMethodEnabled && !insufficientWallet;
  const gatewayLabel = config?.checkout.gatewayLabel?.trim() || "bKash / Nagad";
  const gatewaySubtitle =
    config?.checkout.gatewaySubtitle?.trim() ||
    "Pay Money And Verify With TrxID";

  async function runCart(fn: () => Promise<CartView>) {
    setBusy(true);
    try {
      onCartChange(await fn());
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not update cart. Please try again.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  function scrollToContact() {
    contactSectionRef.current?.scrollIntoView({
      block: "center",
    });
  }

  async function handlePlaceOrder() {
    if (submitLockRef.current || placing || busy) return;
    setContactTouched(true);
    if (!fullName.trim() || !mobile.trim() || !email.trim()) {
      const msg =
        "Please fill in full name, mobile number, and email address before payment.";
      setContactError(msg);
      toast(msg, "error");
      scrollToContact();
      return;
    }
    if (!isValidEmail(email)) {
      const msg = "Please enter a valid email address before payment.";
      setContactError(msg);
      toast(msg, "error");
      scrollToContact();
      return;
    }
    setContactError(null);
    submitLockRef.current = true;
    try {
      await onPlaceOrder({
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
      });
    } finally {
      submitLockRef.current = false;
    }
  }


  return (
    <div className="checkout-page">
      <div className="checkout-topbar-box">
        <h1 className="checkout-topbar-title">
          <span className="checkout-topbar-title-icon" aria-hidden>
            <CreditCardIcon className="h-4 w-4" />
          </span>
          Checkout
        </h1>
        <span className="checkout-topbar-vrule" aria-hidden />
        <nav className="checkout-steps" aria-label="Checkout progress">
          <div className="checkout-step checkout-step--done">
            <span className="checkout-step-dot">
              <CheckIcon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span>Cart</span>
          </div>
          <span className="checkout-step-line" aria-hidden />
          <div className="checkout-step checkout-step--active">
            <span className="checkout-step-dot">2</span>
            <span>Checkout</span>
          </div>
          <span className="checkout-step-line" aria-hidden />
          <div className="checkout-step">
            <span className="checkout-step-dot">3</span>
            <span>Delivery</span>
          </div>
        </nav>
        <span className="checkout-topbar-vrule" aria-hidden />
        <Link href="/cart" className="checkout-back">
          <ArrowLeftIcon className="h-4 w-4" aria-hidden />
          Back to cart
        </Link>
      </div>

      {message ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
        >
          {message}
        </div>
      ) : null}

      <div className="checkout-layout">
        <div className="checkout-main">
          <div ref={contactSectionRef} id="checkout-contact">
            <AdminOrderListCard
              icon={<UserIcon className="h-4 w-4" />}
              title="Contact information"
              subtitle="Where we send your gift card codes"
              className="checkout-contact-card admin-product-form-section"
            >
              <div className="admin-product-form-basic-fields space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={productLabelCls} htmlFor="checkout-name">
                        Full name *
                      </label>
                      <input
                        id="checkout-name"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (contactError) setContactError(null);
                        }}
                        placeholder="Your name"
                        className={productInputCls}
                        required
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <label className={productLabelCls} htmlFor="checkout-mobile">
                        Mobile number *
                      </label>
                      <input
                        id="checkout-mobile"
                        value={mobile}
                        onChange={(e) => {
                          setMobile(e.target.value);
                          if (contactError) setContactError(null);
                        }}
                        placeholder="01XXXXXXXXX"
                        className={productInputCls}
                        required
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={productLabelCls} htmlFor="checkout-email">
                      Email address *
                    </label>
                    <input
                      id="checkout-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (contactError) setContactError(null);
                      }}
                      placeholder="you@example.com"
                      className={productInputCls}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <p className="text-xs text-foreground-muted">
                    Gift card codes will be delivered to this email immediately
                    after payment.
                  </p>
                  {contactTouched && !contactValid ? (
                    <div className="checkout-contact-error" role="alert">
                      <span className="checkout-contact-error-icon" aria-hidden>
                        <InfoIcon className="h-3.5 w-3.5" />
                      </span>
                      <span>
                        {contactError ??
                          "Please fill in full name, mobile number, and email address before payment."}
                      </span>
                    </div>
                  ) : null}
              </div>
            </AdminOrderListCard>
          </div>

          <AdminOrderListCard
            icon={<ChatIcon className="h-4 w-4" />}
            title="Order notes"
            subtitle="Optional — visible on your order history"
            className="checkout-notes-card admin-product-form-section"
          >
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <div className="admin-product-form-basic-fields space-y-2">
                <div>
                  <label className={productLabelCls} htmlFor="checkout-order-note">
                    Order note
                  </label>
                  <textarea
                    id="checkout-order-note"
                    value={orderNote}
                    onChange={(e) =>
                      onOrderNoteChange(e.target.value.slice(0, 500))
                    }
                    rows={4}
                    placeholder="Add any special instructions for this order…"
                    className={`${productInputCls} min-h-[7rem] resize-y`}
                  />
                </div>
                <p className="checkout-char-count">{orderNote.trim().length}/500 characters</p>
              </div>
            </div>
          </AdminOrderListCard>

          <div className="checkout-secure-desktop hidden lg:block">
            <SecureCheckoutCard />
          </div>
        </div>

        <aside className="checkout-sidebar">
          <div className="checkout-summary-card checkout-summary-card--order">
            <header className="checkout-summary-head">
              <span className="checkout-summary-icon" aria-hidden>
                <CartIcon className="h-5 w-5" />
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
            <div className="checkout-items">
              {cart.items.map((it) => (
                <div
                  key={`${it.productId}::${it.variationValueId ?? ""}`}
                  className="checkout-item"
                >
                  <div className="checkout-item-body">
                    <div className="checkout-item-intro">
                      <div className="checkout-item-head">
                        <span className="checkout-item-thumb">
                          {it.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.thumbnail}
                              alt={it.title}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="checkout-item-thumb-fallback">—</span>
                          )}
                        </span>
                        <CheckoutItemHeader
                          title={<p className="m-0">{it.title}</p>}
                        />
                      </div>
                    </div>
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
                          disabled={busy}
                          onClick={() =>
                            runCart(() =>
                              updateCartItem(
                                it.productId,
                                Math.max(0, it.quantity - 1),
                                it.variationValueId,
                              ),
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
                            runCart(() =>
                              updateCartItem(
                                it.productId,
                                it.quantity + 1,
                                it.variationValueId,
                              ),
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
                          runCart(() =>
                            removeCartItem(it.productId, it.variationValueId),
                          )
                        }
                        className="checkout-item-remove"
                        aria-label={`Remove ${it.title}`}
                      >
                        <TrashIcon className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="checkout-totals">
              <div className="checkout-total-row">
                <span>
                  Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
                </span>
                <span><PriceText amount={cart.subtotal} currency={currency} /></span>
              </div>
              {cart.coupon?.valid ? (
                <div className="checkout-total-row checkout-total-row--discount">
                  <span>Coupon ({cart.coupon.code})</span>
                  <span>−<PriceText amount={cart.coupon.discount} currency={currency} /></span>
                </div>
              ) : null}
              {cart.voucher?.valid ? (
                <div className="checkout-total-row checkout-total-row--discount">
                  <span>Voucher ({cart.voucher.code})</span>
                  <span>−<PriceText amount={cart.voucher.applied} currency={currency} /></span>
                </div>
              ) : null}
              <div className="checkout-total-row">
                <span>Delivery</span>
                <span className="checkout-delivery">Instant · Free</span>
              </div>
              <div className="checkout-total-row checkout-total-row--grand">
                <span>TOTAL AMOUNT</span>
                <span><PriceText amount={cart.total} currency={currency} /></span>
              </div>
            </div>
            </div>
          </div>

          <AdminOrderListCard
            icon={<WalletIcon className="h-4 w-4" />}
            title="Payment method"
            subtitle="Choose Your Payment Method"
            className="checkout-payment-card admin-product-form-section"
          >
            <div className="admin-product-form-basic-fields space-y-3">
            {!hasPaymentMethods ? (
              <div className="checkout-balance-alert" role="alert">
                <InfoIcon className="h-4 w-4 shrink-0" aria-hidden />
                <p>No payment methods are enabled. Contact support to complete your order.</p>
              </div>
            ) : null}

            {visiblePaymentOptions.map((option) => {
              if (option.value === "wallet") {
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={paymentMethod === "wallet"}
                    onClick={() => onPaymentMethodChange("wallet")}
                    className={`checkout-pay-option${
                      paymentMethod === "wallet" ? " checkout-pay-option--active" : ""
                    }`}
                  >
                    <span className="checkout-pay-icon">
                      <WalletIcon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="checkout-pay-title">{option.checkoutTitle}</span>
                      <span className="checkout-pay-balance-lines">
                        <span className="checkout-pay-balance-row">
                          <span>Your balance</span>
                          <span className="checkout-pay-balance-value">
                            <PriceText amount={walletBalance} currency={walletCurrency} />
                          </span>
                        </span>
                        {!insufficientWallet ? (
                          <span className="checkout-pay-balance-row checkout-pay-balance-row--after">
                            <span>Balance after payment</span>
                            <span>
                              <PriceText amount={balanceAfterPay} currency={walletCurrency} />
                            </span>
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {paymentMethod === "wallet" ? (
                      <span className="checkout-pay-selected">✓ Selected</span>
                    ) : null}
                  </button>
                );
              }

              if (option.value === "gateway") {
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={paymentMethod === "gateway"}
                    onClick={() => onPaymentMethodChange("gateway")}
                    className={`checkout-pay-option${
                      paymentMethod === "gateway"
                        ? " checkout-pay-option--active"
                        : ""
                    }`}
                  >
                    <span className="checkout-pay-icon">
                      <CreditCardIcon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="checkout-pay-title">{gatewayLabel}</span>
                      <span className="checkout-pay-sub">{gatewaySubtitle}</span>
                    </span>
                    {paymentMethod === "gateway" ? (
                      <span className="checkout-pay-selected">✓ Selected</span>
                    ) : null}
                  </button>
                );
              }

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={paymentMethod === "manual"}
                  onClick={() => onPaymentMethodChange("manual")}
                  className={`checkout-pay-option${
                    paymentMethod === "manual" ? " checkout-pay-option--active" : ""
                  }`}
                >
                  <span className="checkout-pay-icon">
                    <ReceiptIcon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="checkout-pay-title">Manual / bank transfer</span>
                    <span className="checkout-pay-sub">Pay offline and confirm</span>
                  </span>
                  {paymentMethod === "manual" ? (
                    <span className="checkout-pay-selected">✓ Selected</span>
                  ) : null}
                </button>
              );
            })}

            {insufficientWallet ? (
              <div className="checkout-balance-alert" role="alert">
                <InfoIcon className="h-4 w-4 shrink-0" aria-hidden />
                <p>
                  Insufficient balance. You need <PriceText amount={cart.total} currency={currency} />{" "}
                  but have <PriceText amount={walletBalance} currency={walletCurrency} />.{" "}
                  <Link href="/wallet" className="checkout-balance-link">
                    Top up wallet
                  </Link>
                </p>
              </div>
            ) : null}

            {hasPaymentMethods && !paymentMethodEnabled ? (
              <div className="checkout-balance-alert" role="alert">
                <InfoIcon className="h-4 w-4 shrink-0" aria-hidden />
                <p>Please select an available payment method.</p>
              </div>
            ) : null}
            </div>
          </AdminOrderListCard>

          {contactTouched && !contactValid ? (
            <div className="checkout-contact-error checkout-contact-error--pay" role="alert">
              <InfoIcon className="h-4 w-4 shrink-0" aria-hidden />
              <p>
                {contactError ??
                  "Please fill in your contact information before payment."}
              </p>
            </div>
          ) : null}

          <ActionButton
            type="button"
            disabled={placing || busy || !canPlaceOrder}
            loading={placing}
            icon={ZapIcon}
            onClick={handlePlaceOrder}
            className="checkout-pay-btn w-full disabled:opacity-50"
          >
            {placing ? (
              "Processing payment…"
            ) : (
              <>
                Amount To Pay{" "}
                <PriceText amount={cart.total} currency={currency} />
              </>
            )}
          </ActionButton>

          <div className="checkout-secure-mobile lg:hidden">
            <SecureCheckoutCard />
          </div>

          <div className="checkout-chat-spacer" aria-hidden="true" />
        </aside>
      </div>
    </div>
  );
}
