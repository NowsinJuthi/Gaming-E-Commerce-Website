"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { HOME_CONTAINER_CLS } from "@/components/home/home-container";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { MfsPaySelectOrderInfo } from "@/components/checkout/MfsPaySelectOrderInfo";
import { MfsProviderLogo } from "@/components/checkout/MfsProviderLogo";
import { PriceText } from "@/components/ui/PriceText";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CartIcon,
  CheckIcon,
  CopyIcon,
  CreditCardIcon,
  EyeIcon,
  MailIcon,
  PhoneIcon,
  ReceiptIcon,
  UserIcon,
  WalletIcon,
} from "@/components/admin/icons";
import {
  ApiError,
  getMfsCheckoutSession,
  removeMfsCheckoutItem,
  resetMfsGateway,
  selectMfsGateway,
  submitMfsTrxId,
  updateMfsCheckoutItem,
  verifyPaymentIntent,
  type MfsCheckoutSession,
  type MfsGateway,
} from "@/lib/api";
import { orderLineQuantity } from "@/lib/admin-order-view";
import {
  endGuestCheckoutSession,
  ensureShoppingSession,
  isGuestCheckoutSession,
} from "@/lib/guest-checkout";
import { toast } from "@/stores/toast-store";

const PROVIDER_COLORS: Record<string, string> = {
  bkash: "#E2136E",
  nagad: "#F6921E",
  rocket: "#8B2E89",
  upay: "#006A4E",
};

const PROVIDER_PAYMENT_MENU: Record<string, string> = {
  bkash: "Payment",
  nagad: "Send Money",
  rocket: "Send Money",
  upay: "Send Money",
};

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

function formatCopyAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function alertClass(tone: "info" | "success" | "error"): string {
  if (tone === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }
  if (tone === "error") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  return "border-brand/30 bg-brand/10 text-foreground";
}

type Props = {
  intentId: string;
};

export function MfsCheckoutView({ intentId }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<MfsCheckoutSession | null>(null);
  const [trxId, setTrxId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"info" | "success" | "error">("info");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const goToRedirect = useCallback(
    (url: string) => {
      if (isGuestCheckoutSession()) {
        endGuestCheckoutSession();
      }
      if (typeof window !== "undefined") {
        window.location.replace(url);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    try {
      if (!localStorage.getItem("accessToken")) {
        await ensureShoppingSession();
      }
      const data = await getMfsCheckoutSession(intentId);
      setSession(data);
      setSessionExpired(false);
      if (data.submittedTrxId) setTrxId(data.submittedTrxId);
      if (data.status === "succeeded" && data.redirectUrl) {
        goToRedirect(data.redirectUrl);
      }
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSessionExpired(true);
        return null;
      }
      setMsg(err instanceof Error ? err.message : "Could not load payment");
      setMsgTone("error");
      return null;
    } finally {
      setLoading(false);
    }
  }, [intentId, goToRedirect]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onAuthChange() {
      if (sessionExpired && localStorage.getItem("accessToken")) {
        setLoading(true);
        void load();
      }
    }
    window.addEventListener("auth-change", onAuthChange);
    return () => window.removeEventListener("auth-change", onAuthChange);
  }, [sessionExpired, load]);

  useEffect(() => {
    if (!session || session.status === "succeeded") return;
    if (session.status === "failed" || session.status === "expired") return;

    const timer = setInterval(() => {
      void (async () => {
        try {
          await verifyPaymentIntent(intentId);
          const data = await getMfsCheckoutSession(intentId);
          setSession(data);
          if (data.status === "succeeded") {
            const successMsg = "Payment verified successfully!";
            setMsg(successMsg);
            setMsgTone("success");
            toast(successMsg, "success");
            if (data.redirectUrl) {
              setTimeout(() => goToRedirect(data.redirectUrl!), 4000);
            }
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            // Session expired during payment — stop polling and let the user
            // decide when to re-login. Their payment record is safe on the
            // server; they can return to this page after logging in via ?next=.
            clearInterval(timer);
            setSessionExpired(true);
          }
          // Other errors (network / 5xx) are silently retried on next tick.
        }
      })();
    }, 5000);

    return () => clearInterval(timer);
  }, [session, intentId, goToRedirect]);

  async function handleCopy(label: string, value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setMsg(`${label} copied`);
      setMsgTone("info");
      window.setTimeout(
        () => setCopiedKey((current) => (current === key ? null : current)),
        1800,
      );
    } catch {
      setMsg(`Could not copy ${label.toLowerCase()}`);
      setMsgTone("error");
    }
  }

  async function handleSelectGateway(gateway: MfsGateway) {
    setBusy(true);
    setMsg(null);
    try {
      const data = await selectMfsGateway(intentId, gateway.id);
      setSession(data);
      setShowQr(false);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not select gateway");
      setMsgTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetGateway() {
    setBusy(true);
    setMsg(null);
    try {
      const data = await resetMfsGateway(intentId);
      setSession(data);
      setTrxId("");
      setShowQr(false);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not reset");
      setMsgTone("error");
    } finally {
      setBusy(false);
    }
  }

  function applyCheckoutSession(
    data: MfsCheckoutSession,
    redirectIfEmpty = false,
  ) {
    setSession(data);
    if (data.submittedTrxId) {
      setTrxId(data.submittedTrxId);
    } else {
      setTrxId("");
    }
    if (data.status === "expired") {
      window.dispatchEvent(new Event("cart-change"));
      router.push("/cart");
      return;
    }
    if (
      redirectIfEmpty &&
      data.summary?.purpose === "order" &&
      (data.summary.items?.length ?? 0) === 0
    ) {
      window.dispatchEvent(new Event("cart-change"));
      router.push("/cart");
      return;
    }
    if (data.status === "succeeded" && data.redirectUrl) {
      goToRedirect(data.redirectUrl);
    }
  }

  async function handleUpdateItemQuantity(itemIndex: number, quantity: number) {
    setBusy(true);
    setMsg(null);
    try {
      const data = await updateMfsCheckoutItem(intentId, itemIndex, quantity);
      applyCheckoutSession(data);
      setShowQr(false);
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Could not update quantity";
      setMsg(errMsg);
      setMsgTone("error");
      toast(errMsg, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveItem(itemIndex: number) {
    setBusy(true);
    setMsg(null);
    try {
      const data = await removeMfsCheckoutItem(intentId, itemIndex);
      applyCheckoutSession(data, true);
      setShowQr(false);
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Could not remove item";
      setMsg(errMsg);
      setMsgTone("error");
      toast(errMsg, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitTrx(e: React.FormEvent) {
    e.preventDefault();
    if (!trxId.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const data = await submitMfsTrxId(intentId, trxId.trim());
      setSession(data);
      if (data.status === "succeeded") {
        const successMsg = "Payment verified successfully!";
        setMsg(successMsg);
        setMsgTone("success");
        toast(successMsg, "success");
        if (data.redirectUrl) {
          setTimeout(() => goToRedirect(data.redirectUrl!), 4000);
        }
      } else {
        toast(
          "আপনি ভুল ট্রানজেকশন আইডি সাবমিট করেছেন। অনুগ্রহ করে সঠিক ট্রানজেকশন আইডি সাবমিট করুন। অথবা আমাদের সাপোর্টে যোগাযোগ করুন।",
          "warning",
        );
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Verification failed";
      setMsg(errMsg);
      setMsgTone("error");
      toast(errMsg, "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className={`checkout-page ${HOME_CONTAINER_CLS} py-10`}>
        <div className="card-premium border-dashed p-12 text-center text-foreground-muted">
          Loading payment…
        </div>
      </main>
    );
  }

  if (!session) {
    if (sessionExpired) {
      return (
        <main className={`checkout-page ${HOME_CONTAINER_CLS} py-10`}>
          <div className="card-premium flex flex-col gap-3 border-amber-500/30 bg-amber-500/10 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-700 dark:text-amber-200">
              Your session has expired — your payment is safe. Log in again to
              continue.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(`/checkout/pay/${intentId}`)}`}
              className="btn-primary shrink-0 px-4 py-2 text-sm"
            >
              Log in
            </Link>
          </div>
        </main>
      );
    }
    return (
      <main className={`checkout-page ${HOME_CONTAINER_CLS} py-10`}>
        <div className="card-premium border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-700 dark:text-rose-300">
          {msg ?? "Payment session not found"}
        </div>
      </main>
    );
  }

  const selected = session.selectedGateway;
  const waiting =
    session.submittedTrxId &&
    session.status !== "succeeded" &&
    session.status !== "failed";
  const providerLabel = selected?.providerLabel ?? "Mobile wallet";
  const paymentMenu =
    PROVIDER_PAYMENT_MENU[selected?.provider ?? ""] ?? "Send Money";
  const copyAmount = formatCopyAmount(session.amount);

  return (
    <main className={`checkout-page ${HOME_CONTAINER_CLS} py-10`}>
      {sessionExpired ? (
        <div
          className="mb-4 flex flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span>
            Your session has expired — your payment is safe. Log in again to
            continue.
          </span>
          <Link
            href={`/login?next=${encodeURIComponent(`/checkout/pay/${intentId}`)}`}
            className="btn-primary shrink-0 px-4 py-1.5 text-xs"
          >
            Log in
          </Link>
        </div>
      ) : msg ? (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${alertClass(msgTone)}`}
          role="status"
        >
          {msg}
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-3xl space-y-4">
        {session.status === "succeeded" ? (
          <div className="space-y-4">
            {/* Success hero */}
            <div className="card-premium overflow-hidden">
              {/* Green accent bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400" />
              <div className="flex flex-col items-center gap-4 px-6 pb-8 pt-8 text-center">
                {/* Animated success ring */}
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 ring-4 ring-emerald-500/20">
                  <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/10" style={{ animationDuration: "2s", animationIterationCount: "2" }} />
                  <CheckIcon className="h-10 w-10 text-emerald-400" aria-hidden />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Payment Verified!</h1>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {session.summary?.orderNumber
                      ? `Order #${session.summary.orderNumber} has been confirmed.`
                      : "Your payment has been confirmed."}
                  </p>
                </div>
              </div>
            </div>

            {/* Order summary */}
            {session.summary && session.summary.purpose === "order" && (
              <div className="card-premium overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-3 border-b border-border/50 px-5 py-4">
                  <ReceiptIcon className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {session.summary.title}
                    </p>
                  </div>
                  <span className="shrink-0 text-base font-bold text-foreground">
                    <PriceText amount={session.summary.amount} currency={session.summary.currency} />
                  </span>
                </div>

                {/* Items */}
                {session.summary.items && session.summary.items.length > 0 ? (
                  <div className="divide-y divide-border/30">
                    {session.summary.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-foreground-muted">
                          <CartIcon className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-foreground-muted">
                            Qty: {orderLineQuantity(item.quantity)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-foreground">
                          <PriceText amount={item.lineTotal} currency={session.summary!.currency} />
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Pricing breakdown */}
                <div className="space-y-1.5 border-t border-border/50 px-5 py-4">
                  {(session.summary.couponCode || session.summary.voucherCode) && (
                    <div className="flex items-center justify-between text-xs text-foreground-muted">
                      <span>Subtotal</span>
                      <PriceText amount={session.summary.subtotal ?? session.summary.amount} currency={session.summary.currency} />
                    </div>
                  )}
                  {session.summary.couponCode && (
                    <div className="flex items-center justify-between text-xs text-emerald-400">
                      <span>Coupon ({session.summary.couponCode})</span>
                      <span>Applied</span>
                    </div>
                  )}
                  {session.summary.voucherCode && (
                    <div className="flex items-center justify-between text-xs text-emerald-400">
                      <span>Voucher ({session.summary.voucherCode})</span>
                      <span>Applied</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border/30 pt-2 text-sm font-bold text-foreground">
                    <span>Total Paid</span>
                    <span className="text-emerald-400">
                      <PriceText amount={session.summary.amount} currency={session.summary.currency} />
                    </span>
                  </div>
                </div>

                {/* Contact info */}
                {session.summary.contact && (
                  <div className="space-y-2 border-t border-border/50 bg-surface-raised/30 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                      Order placed for
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <UserIcon className="h-3.5 w-3.5 shrink-0 text-foreground-muted" aria-hidden />
                        <span>{session.summary.contact.fullName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-foreground-muted">
                        <PhoneIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>{session.summary.contact.mobile}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-foreground-muted">
                        <MailIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{session.summary.contact.email}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Order note */}
                {session.summary.note && (
                  <div className="border-t border-border/50 px-5 py-3">
                    <p className="text-xs text-foreground-muted">
                      <span className="font-medium text-foreground">Note: </span>
                      {session.summary.note}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Wallet topup success */}
            {session.summary?.purpose === "wallet_topup" && (
              <div className="card-premium flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <ReceiptIcon className="h-5 w-5 text-emerald-400" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Wallet top-up</p>
                  <p className="text-xs text-foreground-muted">Added to your balance</p>
                </div>
                <span className="shrink-0 text-base font-bold text-emerald-400">
                  +<PriceText amount={session.summary.amount} currency={session.summary.currency} />
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              {session.summary?.purpose === "wallet_topup" ? (
                <Link
                  href="/wallet"
                  className="btn-primary flex flex-1 items-center justify-center gap-2"
                >
                  <WalletIcon className="h-4 w-4" aria-hidden />
                  Back to Wallet
                  <ArrowRightIcon className="h-4 w-4" aria-hidden />
                </Link>
              ) : session.redirectUrl ? (
                <Link
                  href={(() => {
                    try {
                      const p = new URL(session.redirectUrl);
                      return (p.pathname + p.search) as "/";
                    } catch {
                      return session.redirectUrl as "/";
                    }
                  })()}
                  onClick={() => { if (isGuestCheckoutSession()) endGuestCheckoutSession(); }}
                  className="btn-primary flex flex-1 items-center justify-center gap-2"
                >
                  <ReceiptIcon className="h-4 w-4" aria-hidden />
                  View Order
                  <ArrowRightIcon className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
              <Link
                href="/products"
                className="btn-secondary flex flex-1 items-center justify-center gap-2"
              >
                <CartIcon className="h-4 w-4" aria-hidden />
                Continue Shopping
              </Link>
            </div>
          </div>
        ) : !selected ? (
          <ProductFormOrderCard
            icon={<CreditCardIcon className="h-4 w-4" aria-hidden />}
            title="Select payment method"
            subtitle="Choose your mobile wallet to complete payment"
            className="checkout-payment-card admin-product-form-section admin-order-list-card mfs-pay-select-panel"
            action={
              <Link
                href={
                  session.summary?.purpose === "wallet_topup" ? "/wallet" : "/cart"
                }
                className="site-header-back-btn shrink-0"
              >
                <ArrowLeftIcon className="h-4 w-4" aria-hidden />
                <span className="truncate">
                  {session.summary?.purpose === "wallet_topup"
                    ? "Back to wallet"
                    : "Back to cart"}
                </span>
              </Link>
            }
            flatBody
          >
            <div className="mfs-pay-select-content">
              {session.summary ? (
                <MfsPaySelectOrderInfo
                  summary={session.summary}
                  busy={busy}
                  editable
                  onUpdateQuantity={(index, quantity) =>
                    void handleUpdateItemQuantity(index, quantity)
                  }
                  onRemoveItem={(index) => void handleRemoveItem(index)}
                />
              ) : null}
              {session.gateways.length === 0 ? (
                <div className="mfs-pay-select-empty space-y-2 text-sm text-foreground-muted">
                  <p>No payment methods configured. Please contact support.</p>
                  <p>
                    Admin: add bKash/Nagad numbers in{" "}
                    <Link
                      href="/admin/settings/payments?tab=mfs"
                      className="font-semibold text-brand hover:underline"
                    >
                      Settings → MFS gateways
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <ul className="mfs-pay-gateway-grid mfs-pay-gateway-grid--select">
                  {session.gateways.map((gw) => (
                    <li key={gw.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSelectGateway(gw)}
                        className="mfs-pay-gateway-option group w-full disabled:opacity-50"
                      >
                        <span className="mfs-pay-gateway-option-logo">
                          <MfsProviderLogo
                            provider={gw.provider}
                            className="mfs-pay-gateway-logo mfs-pay-gateway-logo--picker"
                          />
                        </span>
                        <span className="mfs-pay-gateway-option-label">
                          {gw.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ProductFormOrderCard>
        ) : (
          <div
            className="card-premium mfs-pay-panel mfs-pay-flow-card px-2 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8"
            style={
              {
                "--mfs-accent":
                  PROVIDER_COLORS[selected.provider] ?? "rgb(var(--brand))",
              } as React.CSSProperties
            }
          >
            <header className="mfs-pay-flow-head">
              <div className="flex min-w-0 items-center gap-3">
                <MfsProviderLogo
                  provider={selected.provider}
                  className="mfs-pay-gateway-logo mfs-pay-gateway-logo--picker mfs-pay-flow-logo"
                />
                <div className="min-w-0">
                  <p className="mfs-pay-flow-title-line">
                    <span className="mfs-pay-flow-eyebrow">Pay with</span>
                    <span className="mfs-pay-flow-title">{selected.name}</span>
                  </p>
                  <p className="mfs-pay-flow-amount">
                    <PriceText
                      amount={session.amount}
                      currency={session.currency}
                    />
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleResetGateway()}
                className="btn-secondary mfs-pay-change-btn"
              >
                Change
              </button>
            </header>

            <div className="mfs-pay-steps-panel">
            <ol className="mfs-pay-steps">
              <li className="mfs-pay-step">
                <span className="mfs-pay-step-marker" aria-hidden />
                <p>
                  Go to your <strong>{providerLabel}</strong> Mobile App.
                </p>
              </li>
              <li className="mfs-pay-step">
                <span className="mfs-pay-step-marker" aria-hidden />
                <p>
                  Choose: <strong>{paymentMenu}</strong>
                </p>
              </li>
              <li className="mfs-pay-step">
                <span className="mfs-pay-step-marker" aria-hidden />
                <div className="mfs-pay-step-body">
                  <div className="mfs-pay-copy-card">
                    <div className="mfs-pay-copy-card-head">
                      <span className="mfs-pay-copy-card-label">
                        Enter the Number
                      </span>
                      {selected.qrCodeUrl ? (
                        <button
                          type="button"
                          className="mfs-pay-copy-btn mfs-pay-copy-btn--secondary mfs-pay-copy-btn--compact"
                          onClick={() => setShowQr((value) => !value)}
                        >
                          {showQr ? (
                            <EyeOffIcon className="h-3.5 w-3.5" />
                          ) : (
                            <EyeIcon className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {showQr ? "Hide QR" : "Show QR"}
                        </button>
                      ) : null}
                    </div>
                    <div className="mfs-pay-copy-card-row">
                      <div className="mfs-pay-copy-card-value-wrap">
                        <strong className="mfs-pay-copy-card-value">
                          {selected.phoneNumber}
                        </strong>
                      </div>
                      <div className="mfs-pay-copy-card-actions">
                        <button
                          type="button"
                          className={`mfs-pay-copy-icon${copiedKey === "number" ? " mfs-pay-copy-icon--copied" : ""}`}
                          aria-label={
                            copiedKey === "number" ? "Copied" : "Copy number"
                          }
                          title={
                            copiedKey === "number" ? "Copied" : "Copy number"
                          }
                          onClick={() =>
                            void handleCopy(
                              "Number",
                              selected.phoneNumber,
                              "number",
                            )
                          }
                        >
                          {copiedKey === "number" ? (
                            <CheckIcon className="h-4 w-4" aria-hidden />
                          ) : (
                            <CopyIcon className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  {showQr && selected.qrCodeUrl ? (
                    <div className="mfs-pay-qr-wrap mfs-pay-qr-wrap--inline">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selected.qrCodeUrl}
                        alt={`${selected.name} QR code`}
                        className="mfs-pay-qr"
                      />
                    </div>
                  ) : null}
                </div>
              </li>
              <li className="mfs-pay-step">
                <span className="mfs-pay-step-marker" aria-hidden />
                <div className="mfs-pay-step-body">
                  <div className="mfs-pay-copy-card">
                    <span className="mfs-pay-copy-card-label">
                      Enter the Amount
                    </span>
                    <div className="mfs-pay-copy-card-row">
                      <div className="mfs-pay-copy-card-value-wrap">
                        <strong className="mfs-pay-copy-card-value">
                          <PriceText
                            amount={session.amount}
                            currency={session.currency}
                          />
                        </strong>
                      </div>
                      <div className="mfs-pay-copy-card-actions">
                        <button
                          type="button"
                          className={`mfs-pay-copy-icon${copiedKey === "amount" ? " mfs-pay-copy-icon--copied" : ""}`}
                          aria-label={
                            copiedKey === "amount" ? "Copied" : "Copy amount"
                          }
                          title={
                            copiedKey === "amount" ? "Copied" : "Copy amount"
                          }
                          onClick={() =>
                            void handleCopy("Amount", copyAmount, "amount")
                          }
                        >
                          {copiedKey === "amount" ? (
                            <CheckIcon className="h-4 w-4" aria-hidden />
                          ) : (
                            <CopyIcon className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              <li className="mfs-pay-step">
                <span className="mfs-pay-step-marker" aria-hidden />
                <p>
                  Now enter your <strong>{providerLabel}</strong> PIN to
                  confirm.
                </p>
              </li>
              <li className="mfs-pay-step">
                <span className="mfs-pay-step-marker" aria-hidden />
                <p>
                  Put the <strong>Transaction ID</strong> in the box below and
                  press <strong>Verify</strong>.
                </p>
              </li>
            </ol>
            </div>

            {selected.instructions?.trim() ? (
              <p className="mfs-pay-custom-note">{selected.instructions.trim()}</p>
            ) : null}

            <form onSubmit={handleSubmitTrx} className="mfs-pay-trx-form">
              <label className="mfs-pay-trx-label" htmlFor="mfs-trx-id">
                Transaction ID
              </label>
              <input
                id="mfs-trx-id"
                type="text"
                value={trxId}
                onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                placeholder="Enter Transaction ID"
                className="input-field mfs-pay-trx-input w-full uppercase"
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                className="btn-primary mfs-pay-verify-btn w-full uppercase tracking-wide disabled:opacity-50"
                disabled={busy || !trxId.trim()}
              >
                {busy ? "Verifying…" : "Verify"}
              </button>
              {waiting ? (
                <p className="mfs-pay-waiting-note">
                  Waiting for SMS verification… checking every 5 seconds
                </p>
              ) : null}
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
